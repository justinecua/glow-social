from drf_yasg import openapi

get_all_accounts_schema = {
    200: openapi.Response(
        "Success",
        openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'id': openapi.Schema(type=openapi.TYPE_INTEGER, description="User ID"),
                    'firstname': openapi.Schema(type=openapi.TYPE_STRING, description="User's first name"),
                    'lastname': openapi.Schema(type=openapi.TYPE_STRING, description="User's last name"),
                    'gender': openapi.Schema(type=openapi.TYPE_STRING, description="User's gender"),
                    'age': openapi.Schema(type=openapi.TYPE_INTEGER, description="User's age"),
                    'birthday': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATE, description="User's birthday"),
                    'bio': openapi.Schema(type=openapi.TYPE_STRING, description="User's bio"),
                    'profile_photo': openapi.Schema(
                        type=openapi.TYPE_STRING, 
                        format=openapi.FORMAT_URI, 
                        description="Profile photo URL",
                        default="https://ik.imagekit.io/b9bdd5j68/6ce6306d23f2b7e78645fb82dce6c217_RixEx3FWl.jpg"
                    ),
                    'cover_photo': openapi.Schema(
                        type=openapi.TYPE_STRING, 
                        format=openapi.FORMAT_URI, 
                        description="Cover photo URL",
                        default="https://ik.imagekit.io/b9bdd5j68/737474_P74GayAE7.png" 
                    ),
                    'last_activity': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME, description="Last activity timestamp"),
                    'is_online': openapi.Schema(type=openapi.TYPE_BOOLEAN, description="Online status"),
                    'auth_user_id': openapi.Schema(type=openapi.TYPE_INTEGER, description="Auth User ID"),
                    'cover_photo_id_imagekit': openapi.Schema(type=openapi.TYPE_STRING, description="Cover photo ImageKit ID"),
                    'profile_photo_id_imagekit': openapi.Schema(type=openapi.TYPE_STRING, description="Profile photo ImageKit ID"),
                    'ui_appearance': openapi.Schema(type=openapi.TYPE_STRING, description="User interface appearance preference"),
                }
            )
        )
    )
}

login_schema = {
    200: openapi.Response(
        "Success",
        openapi.Schema(
            type=openapi.TYPE_OBJECT,  
            properties={
                'id': openapi.Schema(type=openapi.TYPE_INTEGER, description="User ID"),
                'firstname': openapi.Schema(type=openapi.TYPE_STRING, description="User's first name"),
                'lastname': openapi.Schema(type=openapi.TYPE_STRING, description="User's last name"),
                'gender': openapi.Schema(type=openapi.TYPE_STRING, description="User's gender"),
                'age': openapi.Schema(type=openapi.TYPE_INTEGER, description="User's age"),
                'birthday': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATE, description="User's birthday"),
                'bio': openapi.Schema(type=openapi.TYPE_STRING, description="User's bio"),
                'profile_photo': openapi.Schema(
                    type=openapi.TYPE_STRING, 
                    format=openapi.FORMAT_URI, 
                    description="Profile photo URL",
                    default="https://ik.imagekit.io/b9bdd5j68/6ce6306d23f2b7e78645fb82dce6c217_RixEx3FWl.jpg"
                ),
                'cover_photo': openapi.Schema(
                    type=openapi.TYPE_STRING, 
                    format=openapi.FORMAT_URI, 
                    description="Cover photo URL",
                    default="https://ik.imagekit.io/b9bdd5j68/737474_P74GayAE7.png" 
                ),
                'last_activity': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME, description="Last activity timestamp"),
                'is_online': openapi.Schema(type=openapi.TYPE_BOOLEAN, description="Online status"),
                'auth_user_id': openapi.Schema(type=openapi.TYPE_INTEGER, description="Auth User ID"),
                'cover_photo_id_imagekit': openapi.Schema(type=openapi.TYPE_STRING, description="Cover photo ImageKit ID"),
                'profile_photo_id_imagekit': openapi.Schema(type=openapi.TYPE_STRING, description="Profile photo ImageKit ID"),
                'ui_appearance': openapi.Schema(type=openapi.TYPE_STRING, description="User interface appearance preference"),
                'username': openapi.Schema(type=openapi.TYPE_STRING, description="Username"),
                'date_joined': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME, description="Date joined"),
            }
        )
    ),
}

register_schema = {
    201: openapi.Response(
        "User created successfully",
        openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'id': openapi.Schema(type=openapi.TYPE_INTEGER, description="User ID"),
                'username': openapi.Schema(type=openapi.TYPE_STRING, description="Username"),
                'email': openapi.Schema(type=openapi.TYPE_STRING, description="Email address"),
                'date_joined': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATETIME, description="Date joined"),
            }
        )
    ),
}

forgot_password_schema = {
    200: openapi.Response(
        "Password reset email sent successfully.",
        openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "message": openapi.Schema(
                    type=openapi.TYPE_STRING, 
                    description="Confirmation message."
                ),
                "status": openapi.Schema(
                    type=openapi.TYPE_INTEGER, 
                    description="HTTP status code (200 for success)."
                ),
            },
        ),
    ),
}
