
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from drf_yasg.utils import swagger_auto_schema
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.http import JsonResponse
from datetime import timedelta
from .registration import validate_registration
from .legal import TERMS_VERSION, MIN_AGE
from .models import Account
from .auth_utils import current_account_id, make_ws_ticket
from .account_data import export_user_data, delete_user_account



from .queries import (
    getAllAccounts,
    login,
    register,
    forgot_password,
    getNewUsers,
    getProfile,
    getTotalGlowsPostByUser,
    reset_password
)

from .api.decorators import (
    get_all_accounts_decorator,
    login_decorator,
    register_decorator,
    forgot_password_decorator
)

from GlowProject.throttles import AuthThrottle, WriteThrottle
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

AUTH_THROTTLES = (AnonRateThrottle, UserRateThrottle, WriteThrottle, AuthThrottle)

class GetAllAccounts(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @get_all_accounts_decorator()
    def get(self, request):
        data = getAllAccounts() 
        return Response(data)

class Login(APIView):
    throttle_classes = AUTH_THROTTLES
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user_data = login(username, password)

        if user_data is None or user_data.get("error") == "internal_error":
            return Response({"detail": "An error occurred."}, status=500)

        if user_data.get("error") == "username_not_found":
            return Response({"detail": "Username not found."}, status=404)

        if user_data.get("error") == "password_incorrect":
            return Response({"detail": "Password is incorrect."}, status=401)

        user_data.pop("password", None)
                      
        refresh = RefreshToken()
        refresh.payload.update({"user_id": user_data["user_id"], "username": user_data["username"]})

        #Websocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "global",
            {
                "type": "user_logged_in",
                "username": username,
            }
        )

        refresh["user_id"] = user_data["user_id"]
        refresh["username"] = user_data["username"]

        response = JsonResponse({"user": user_data})
        print(response)

        access_token_expiry = timedelta(minutes=5)
        refresh_token_expiry = timedelta(days=7)

        # TEMPORARY DEV-ONLY: set `secure=False`
        response.set_cookie(
            key="access_token",
            value=str(refresh.access_token),
            httponly=True,
            secure=False,            # 🔥 change this for development
            samesite="Lax",          # change back from "None" since not cross-site now
            max_age=int(access_token_expiry.total_seconds())
        )

        response.set_cookie(
            key="refresh_token",
            value=str(refresh),
            httponly=True,
            secure=False,
            samesite="Lax",
            max_age=int(refresh_token_expiry.total_seconds())
        )


        return response

class Logout(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        # The refresh token lives in an HttpOnly cookie the frontend can't
        # read, so take it from there (body still accepted for API clients).
        refresh_token = request.COOKIES.get("refresh_token") or request.data.get("refresh")
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass  # already expired/blacklisted: still log the user out

        response = Response({"detail": "Logout successful."}, status=status.HTTP_200_OK)
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response


class Register(APIView):
    throttle_classes = AUTH_THROTTLES
    permission_classes = (permissions.AllowAny,)

    @register_decorator()
    def post(self, request):
        cleaned, errors = validate_registration(request.data)
        if errors:
            return Response(
                {
                    "message": next(iter(errors.values())),
                    "errors": errors,
                    "status": 400,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = register(**cleaned)
        return Response(data, status=data.get("status", 200))

class ForgotPassword(APIView):
    throttle_classes = AUTH_THROTTLES
    permission_classes = (permissions.AllowAny,)

    @forgot_password_decorator()
    def post(self, request):
        email = request.data.get("email")

        data = forgot_password(email) 
        return Response(data)

class ResetPassword(APIView):
    throttle_classes = AUTH_THROTTLES
    permission_classes = (permissions.AllowAny,)
    
    def post(self, request):
        token = request.data.get('token')
        new_password = request.data.get('new_password')

        data = reset_password(token, new_password)
        return Response(data)
    
class GetNewUsers(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        data = getNewUsers() 
        return Response(data)

class GetProfile(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, profile_id):
        # Public endpoint: an expired/invalid cookie must not turn this into
        # a 401, so fall back to anonymous if authentication fails.
        try:
            viewer = request.user if request.user.is_authenticated else None
        except Exception:
            viewer = None
        data = getProfile(profile_id, viewer_user_id=viewer.id if viewer else None)
        return Response(data)

class UpdateMyProfile(APIView):
    """PATCH your own profile: names, bio, gender, birthday, photos."""
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request):
        from .profile_edit import ProfileError, update_profile

        account = Account.objects.filter(auth_user=request.user).first()
        if not account:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            data = update_profile(account, request.data, request=request)
        except ProfileError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(data)


class GetTotalGlowsPostByUser(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, profile_id):
        data = getTotalGlowsPostByUser(profile_id)
        return Response(data)

from rest_framework.permissions import IsAuthenticated

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Same shape as the login response's "user", so the frontend has
        # account_id, photo and names after a page refresh too.
        user = request.user
        account = Account.objects.filter(auth_user=user).first()
        return Response({
            "user": {
                "user_id": user.id,
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "date_joined": user.date_joined,
                "account_id": account.id if account else None,
                "firstname": account.firstname if account else "",
                "lastname": account.lastname if account else "",
                "profile_photo": account.profile_photo if account else None,
                "cover_photo": account.cover_photo if account else "",
                "bio": account.bio if account else "",
                "gender": account.gender if account else "",
                "birthday": account.birthday if account else None,
            }
        })

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed

class CookieTokenRefreshView(APIView):
    # The access token is usually *expired* when this is called, so this
    # endpoint must not require (or attempt) access-token authentication.
    permission_classes = (permissions.AllowAny,)
    authentication_classes = ()

    def post(self, request):
        # Explicit 401s: with authentication_classes = () DRF would turn
        # AuthenticationFailed into a 403, which clients don't treat as
        # "session expired".
        refresh_token = request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token not found in cookies."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh = RefreshToken(refresh_token)  # also rejects blacklisted tokens
            access_token = str(refresh.access_token)
        except Exception:
            return Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # The server authenticates from the access_token cookie, so the new
        # token has to go into that cookie (returning it in the body alone
        # left everyone logged out 5 minutes after logging in).
        response = Response({"access": access_token})
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,  # match the login cookie; set True in production (HTTPS)
            samesite="Lax",
            max_age=int(timedelta(minutes=5).total_seconds()),
        )
        return response


class LegalInfo(APIView):
    """Current Terms version and minimum age, so the client stays in sync."""
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        return Response({"terms_version": TERMS_VERSION, "min_age": MIN_AGE})


class ExportMyData(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        data = export_user_data(request.user)
        response = JsonResponse(data, json_dumps_params={"indent": 2})
        response["Content-Disposition"] = (
            f'attachment; filename="glow-data-{request.user.username}.json"'
        )
        return response


class DeleteMyAccount(APIView):
    """Permanently delete the signed-in user's account. Requires the
    current password so a hijacked session can't wipe an account."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        password = request.data.get("password") or ""
        if not request.user.check_password(password):
            return Response(
                {"detail": "Password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh_token = request.COOKIES.get("refresh_token") or request.data.get("refresh")
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except Exception:
                pass

        delete_user_account(request.user)

        response = Response({"detail": "Your account has been deleted."})
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response


class WebSocketTicket(APIView):
    """Short-lived signed ticket the frontend passes when opening the
    WebSocket, so the socket is tied to the signed-in user."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response({"ticket": make_ws_ticket(current_account_id(request))})


class InviteInfo(APIView):
    """Public card for /invite/<username>: who invited you."""
    permission_classes = (permissions.AllowAny,)

    def get(self, request, username):
        account = (
            Account.objects.select_related("auth_user")
            .filter(auth_user__username__iexact=username, auth_user__is_active=True)
            .first()
        )
        if not account:
            return Response({"detail": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "id": account.id,
            "username": account.auth_user.username,
            "firstname": account.firstname or "",
            "lastname": account.lastname or "",
            "profile_photo": account.profile_photo or "",
        })


class MyInvites(APIView):
    """How many people joined from my invite link, and who."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        me = current_account_id(request)
        invitees = (
            Account.objects.select_related("auth_user")
            .filter(invited_by_id=me, auth_user__is_active=True)
            .order_by("-auth_user__date_joined")
        )
        return Response({
            "count": invitees.count(),
            "invitees": [
                {
                    "id": a.id,
                    "username": a.auth_user.username,
                    "firstname": a.firstname or "",
                    "lastname": a.lastname or "",
                    "profile_photo": a.profile_photo or "",
                    "joined": a.auth_user.date_joined.isoformat(),
                }
                for a in invitees[:50]
            ],
        })


class Onboarding(APIView):
    """Progress on the welcome steps shown to new users."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from django.db.models import Q
        from friends.models import Friend
        from posts.models import Post

        me = current_account_id(request)
        account = Account.objects.get(id=me)
        connections_count = Friend.objects.filter(
            Q(user_id=me) | Q(friend_id=me), status__in=["Friends", "Pending"]
        ).count()
        posts = Post.objects.filter(account_id=me).count()
        steps = {
            "photo": bool(account.profile_photo),
            "friends": connections_count >= 3,
            "post": posts > 0,
        }
        return Response({
            "steps": steps,
            "friends_count": connections_count,
            "posts_count": posts,
            "done": all(steps.values()),
        })
