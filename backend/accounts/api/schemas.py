from drf_yasg import openapi

MESSAGE_RESPONSE = openapi.Schema(
    type=openapi.TYPE_OBJECT,
    properties={
        "message": openapi.Schema(type=openapi.TYPE_STRING, description="Text to show the user."),
        "status": openapi.Schema(type=openapi.TYPE_INTEGER, description="Same as the HTTP status code."),
    },
)

register_schema = {
    201: openapi.Response("Account created.", MESSAGE_RESPONSE),
    400: openapi.Response(
        "Invalid input, or username/email already in use.",
        openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "message": openapi.Schema(type=openapi.TYPE_STRING),
                "status": openapi.Schema(type=openapi.TYPE_INTEGER),
                "errors": openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    description="Field name -> error message (validation errors only).",
                ),
            },
        ),
    ),
}

forgot_password_schema = {
    200: openapi.Response("Same reply whether or not the email has an account.", MESSAGE_RESPONSE),
    502: openapi.Response("The email service failed.", MESSAGE_RESPONSE),
}
