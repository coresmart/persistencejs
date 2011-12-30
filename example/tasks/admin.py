from django.contrib import admin
from models import Task

class TaskAdmin(admin.ModelAdmin):
    def active(self, obj):
        return (obj.date_deleted == None)
    active.boolean = True
    
    fields = ['guid', 'name', 'priority', 'description', 'user', 'assigned_to', 'date_due', 'date_completed', 'date_created', 'date_modified', 'date_deleted']
    readonly_fields = ['guid', 'date_created', 'date_modified', 'date_deleted']
    list_display = ['name', 'date_due', 'date_completed', 'user', 'assigned_to', 'active']

admin.site.register(Task, TaskAdmin)