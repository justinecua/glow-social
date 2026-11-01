from django.contrib import admin

from .models import GlowNote


@admin.register(GlowNote)
class GlowNoteAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "recipient", "message", "created_at", "is_hidden")
    list_filter = ("is_hidden", "created_at")
    list_editable = ("is_hidden",)
    search_fields = ("message", "sender__auth_user__username", "recipient__auth_user__username")
    raw_id_fields = ("sender", "recipient", "passed_from")
