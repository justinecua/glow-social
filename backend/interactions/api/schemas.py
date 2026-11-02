from drf_yasg import openapi

show_comments_schema = {
    200: openapi.Response(
        "List of comments on a post",
        openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'comment_id': openapi.Schema(
                        type=openapi.TYPE_INTEGER, 
                        description="Unique identifier for the comment"
                    ),
                    'comment': openapi.Schema(
                        type=openapi.TYPE_STRING, 
                        description="Content of the comment"
                    ),
                    'dateTime': openapi.Schema(
                        type=openapi.TYPE_STRING, 
                        format=openapi.FORMAT_DATETIME,
                        description="Timestamp when the comment was posted"
                    ),
                    'username': openapi.Schema(
                        type=openapi.TYPE_STRING, 
                        description="Username of the commenter"
                    ),
                    'profile_photo': openapi.Schema(
                        type=openapi.TYPE_STRING, 
                        format=openapi.FORMAT_URI, 
                        description="Profile photo URL",
                    ),
                }
            )
        )
    ),
}
