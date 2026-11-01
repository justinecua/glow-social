from django.contrib import admin

# Register your models here.

from .models import DailyPrompt


@admin.register(DailyPrompt)
class DailyPromptAdmin(admin.ModelAdmin):
    list_display = ("text", "tag", "date", "is_active")
    list_filter = ("is_active",)
    list_editable = ("is_active",)
    search_fields = ("text", "tag")
