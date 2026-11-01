from django.contrib import admin

from .models import Spark


@admin.register(Spark)
class SparkAdmin(admin.ModelAdmin):
    list_display = ("id", "account", "text", "close_friends_only", "created_at", "expires_at")
    list_filter = ("close_friends_only",)
