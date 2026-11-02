from drf_yasg.utils import swagger_auto_schema

from .schemas import forgot_password_schema, register_schema


def register_decorator():
    return swagger_auto_schema(
        operation_description="Endpoint for user registration",
        responses=register_schema,
    )


def forgot_password_decorator():
    return swagger_auto_schema(
        operation_description="Request a password reset email",
        responses=forgot_password_schema,
    )
