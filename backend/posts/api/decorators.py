from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .schemas import (
    get_posts_schema,
)

def get_posts_decorator():
    return swagger_auto_schema(
        operation_description="Retrieve a comprehensive list of posts, including captions, timestamps, and associated user informatio",
        responses=get_posts_schema,
    )
