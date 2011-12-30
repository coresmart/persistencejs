from django.contrib import admin
from models import Note

class NoteAdmin(admin.ModelAdmin):
    def active(self, obj):
        return (obj.date_deleted == None)
    active.boolean = True

    fields = ['guid', 'subject', 'content', 'user', 'date_created', 'date_modified', 'task' ]
    readonly_fields = ['guid', 'task', 'date_created', 'date_modified']
    list_display = ['subject', 'user', 'date_created', 'active']

admin.site.register(Note, NoteAdmin)