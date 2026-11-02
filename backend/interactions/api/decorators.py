from drf_yasg.utils import swagger_auto_schema

from .schemas import show_comments_schema


def show_comments_decorator():
    return swagger_auto_schema(
        operation_description="All comments on a post the viewer is allowed to see, oldest first.",
        responses=show_comments_schema,
    )
