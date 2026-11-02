from django.conf import settings
from django.http import JsonResponse
from rest_framework import permissions, status
from rest_framework.exceptions import APIException
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from GlowProject.throttles import AuthThrottle, WriteThrottle

from .account_data import delete_user_account, export_user_data
from .api.decorators import forgot_password_decorator, register_decorator
from .auth_utils import current_account_id, make_ws_ticket
from .legal import MIN_AGE, TERMS_VERSION
from .profile_edit import ProfileError, get_account, update_profile
from .queries import (
    count_glows_received,
    find_invite,
    forgot_password,
    get_new_users,
    get_profile,
    list_invitees,
    login,
    onboarding_progress,
    register,
    reset_password,
    signed_in_user,
)
from .registration import validate_registration

AUTH_THROTTLES = (AnonRateThrottle, UserRateThrottle, WriteThrottle, AuthThrottle)


def _set_cookie(response, key, value, lifetime):
    jwt = settings.SIMPLE_JWT
    response.set_cookie(
        key=key,
        value=value,
        httponly=jwt["AUTH_COOKIE_HTTP_ONLY"],
        secure=jwt["AUTH_COOKIE_SECURE"],
        samesite=jwt["AUTH_COOKIE_SAMESITE"],
        max_age=int(lifetime.total_seconds()),
    )


def _set_access_cookie(response, access_token):
    _set_cookie(response, "access_token", access_token, settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"])


def _set_refresh_cookie(response, refresh_token):
    _set_cookie(response, "refresh_token", refresh_token, settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"])


def _clear_auth_cookies(response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")


def _blacklist_refresh(request):
    token = request.COOKIES.get("refresh_token") or request.data.get("refresh")  # body accepted for API clients
    if not token:
        return
    try:
        RefreshToken(token).blacklist()
    except TokenError:
        pass  # already expired or blacklisted


class Login(APIView):
    throttle_classes = AUTH_THROTTLES
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        user = login(request.data.get("username"), request.data.get("password"))
        if not user:
            return Response(
                {"detail": "Incorrect username or password."},  # one message, so usernames can't be probed
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken()
        refresh["user_id"] = user["user_id"]
        refresh["username"] = user["username"]

        response = Response({"user": user})
        _set_access_cookie(response, str(refresh.access_token))
        _set_refresh_cookie(response, str(refresh))
        return response


class Logout(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        _blacklist_refresh(request)
        response = Response({"detail": "Logout successful."})
        _clear_auth_cookies(response)
        return response


class CookieTokenRefreshView(APIView):
    permission_classes = (permissions.AllowAny,)
    authentication_classes = ()  # access token is usually expired here

    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response(status=status.HTTP_204_NO_CONTENT)  # signed out: nothing to refresh, not an error
        try:
            access_token = str(RefreshToken(refresh_token).access_token)  # rejects blacklisted tokens
        except TokenError:
            response = Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_401_UNAUTHORIZED,  # explicit 401, DRF would send 403
            )
            _clear_auth_cookies(response)  # so the next page load is a clean signed-out visit
            return response

        response = Response({"access": access_token})
        _set_access_cookie(response, access_token)  # server reads the cookie, not the body
        return response


class WebSocketTicket(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response({"ticket": make_ws_ticket(current_account_id(request))})


class Register(APIView):
    throttle_classes = AUTH_THROTTLES
    permission_classes = (permissions.AllowAny,)

    @register_decorator()
    def post(self, request):
        cleaned, errors = validate_registration(request.data)
        if errors:
            return Response(
                {"message": next(iter(errors.values())), "errors": errors, "status": 400},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = register(**cleaned)
        return Response(data, status=data["status"])


class ForgotPassword(APIView):
    throttle_classes = AUTH_THROTTLES
    permission_classes = (permissions.AllowAny,)

    @forgot_password_decorator()
    def post(self, request):
        data = forgot_password(request.data.get("email"))
        return Response(data, status=data["status"])


class ResetPassword(APIView):
    throttle_classes = AUTH_THROTTLES
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        data = reset_password(request.data.get("token"), request.data.get("new_password"))
        return Response(data, status=data["status"])


class LegalInfo(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        return Response({"terms_version": TERMS_VERSION, "min_age": MIN_AGE})


class GetNewUsers(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        return Response(get_new_users())


class GetProfile(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, profile_id):
        try:
            viewer = request.user if request.user.is_authenticated else None
        except APIException:
            viewer = None  # bad cookie: treat as anonymous, not 401
        return Response(get_profile(profile_id, viewer_user_id=viewer.id if viewer else None))


class GetTotalGlowsPostByUser(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, profile_id):
        return Response(count_glows_received(profile_id))


class MeView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        user = request.user
        if not user.is_authenticated:
            if request.COOKIES.get("refresh_token"):
                return Response(status=status.HTTP_401_UNAUTHORIZED)  # access expired: client refreshes and retries
            return Response({"user": None})  # signed out is a normal state, not an error
        return Response({"user": signed_in_user(user.id)})


class UpdateMyProfile(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request):
        account = get_account(request.user.id)
        if not account:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            data = update_profile(account, request.data)
        except ProfileError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class ExportMyData(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        response = JsonResponse(export_user_data(request.user), json_dumps_params={"indent": 2})
        response["Content-Disposition"] = (
            f'attachment; filename="glow-data-{request.user.username}.json"'
        )
        return response


class DeleteMyAccount(APIView):
    throttle_classes = AUTH_THROTTLES  # it checks a password, so limit guesses like login does
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        if not request.user.check_password(request.data.get("password") or ""):  # stops hijacked sessions
            return Response({"detail": "Password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

        _blacklist_refresh(request)
        delete_user_account(request.user)

        response = Response({"detail": "Your account has been deleted."})
        _clear_auth_cookies(response)
        return response


class InviteInfo(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, username):
        invite = find_invite(username)
        if not invite:
            return Response({"detail": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(invite)


class MyInvites(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(list_invitees(current_account_id(request)))


class Onboarding(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(onboarding_progress(current_account_id(request)))
