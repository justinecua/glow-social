from drf_yasg import openapi

get_posts_schema = {
    200: openapi.Response(
        "List of posts",
        openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'id': openapi.Schema(type=openapi.TYPE_INTEGER, description="Post ID"),
                    'account_id': openapi.Schema(type=openapi.TYPE_INTEGER, description="Account ID"),
                    'caption': openapi.Schema(type=openapi.TYPE_STRING, description="Post caption"),
                    'dateTime': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME, description="Date and time of the post"),
                    'username': openapi.Schema(type=openapi.TYPE_STRING, description="Username of the poster"),
                    'link': openapi.Schema(type=openapi.TYPE_STRING, description="Link to the post photo"),
                }
            )
        )
    ),
}

