from django.contrib import admin

from .models import Conversation, ConversationMember, Message


class MemberInline(admin.TabularInline):
    model = ConversationMember
    raw_id_fields = ("account",)
    extra = 0


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "is_group", "title", "created_by", "updated_at")
    list_filter = ("is_group",)
    inlines = [MemberInline]
    raw_id_fields = ("created_by",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "created_at", "is_deleted")  # admins can soft-delete reported messages
    list_filter = ("is_deleted",)
    list_editable = ("is_deleted",)
    raw_id_fields = ("conversation", "sender")
