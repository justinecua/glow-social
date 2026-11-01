from drf_yasg import openapi

count_glows_schema = {
    200: openapi.Response(
        "Total number of glows in a post",
        openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'total_glows': openapi.Schema(type=openapi.TYPE_INTEGER, description="Total glows"),
                }
            )
        )
    ),
}

get_profile_glows_schema = {
    200: openapi.Response(
        "List of glows on a post",
        openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'glow_id': openapi.Schema(type=openapi.TYPE_INTEGER, description="Glow (like) ID"),
                    'timestamp': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME, description="Time when the glow was made"),
                    'account_id': openapi.Schema(type=openapi.TYPE_INTEGER, description="Account ID of the user who gave the glow"),
                    'post_id': openapi.Schema(type=openapi.TYPE_INTEGER, description="ID of the post that received the glow"),
                    'firstname': openapi.Schema(type=openapi.TYPE_STRING, description="First name of the user"),
                    'lastname': openapi.Schema(type=openapi.TYPE_STRING, description="Last name of the user"),
                                        'profile_photo': openapi.Schema(
                        type=openapi.TYPE_STRING, 
                        format=openapi.FORMAT_URI, 
                        description="Profile photo URL",
                        default="https://ik.imagekit.io/b9bdd5j68/6ce6306d23f2b7e78645fb82dce6c217_RixEx3FWl.jpg"
                    ),                }
            )
        )
    ),
}

count_comments_schema = {
    200: openapi.Response(
        "Total number of comments in a post",
        openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'total_comment': openapi.Schema(type=openapi.TYPE_INTEGER, description="Total comments"),
                }
            )
        )
    ),
}

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
                        default="https://ik.imagekit.io/b9bdd5j68/6ce6306d23f2b7e78645fb82dce6c217_RixEx3FWl.jpg"
                    ),
                }
            )
        )
    ),
}
