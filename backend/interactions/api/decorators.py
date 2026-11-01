from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .schemas import (
    count_glows_schema,
    get_profile_glows_schema,
    count_comments_schema,
    show_comments_schema
)

def count_glows_decorator():
    return swagger_auto_schema(
        operation_description="Total number of glows in a post",
        responses=count_glows_schema,
    )

def get_profile_glows_decorator():
    return swagger_auto_schema(
        operation_description="Retrieve a list of glows (likes) on a specific post, including user profile details.",
        responses=get_profile_glows_schema,
    )

def count_comments_decorator():
    return swagger_auto_schema(
        operation_description="Total number of comments in a post",
        responses=count_comments_schema,
    )

def show_comments_decorator():
    return swagger_auto_schema(
        operation_description="Retrieve all comments for a specific post",
        responses=show_comments_schema,
    )
