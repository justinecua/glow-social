from django.contrib import admin

from .models import PlaySession, PlaySessionPlayer

admin.site.register(PlaySession)
admin.site.register(PlaySessionPlayer)
