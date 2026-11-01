from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .schemas import (
    get_all_accounts_schema,
    login_schema,
    register_schema,
    forgot_password_schema
)

def get_all_accounts_decorator():
    return swagger_auto_schema(
        operation_description="Retrieve a list of all user accounts with detailed profile information.",
        responses=get_all_accounts_schema,
    )

def login_decorator():
    return swagger_auto_schema(
        operation_description="Authenticate user and return user profile and authentication token.",
        responses=login_schema,
    )

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





