from django.db import models
from django.contrib.auth.models import User

import persistencejs
from persistencejs.base import PersistentRecord
from persistencejs.models import PersistentModel

# Create your models here.
PRIORITY_CHOICES = (
    (1, "High"),
    (2, "Medium"),
    (3, "Low"),
)
class Task(PersistentModel):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    priority = models.IntegerField(choices=PRIORITY_CHOICES)
    date_due = models.DateTimeField(null=True, blank=True)
    date_completed = models.DateTimeField(null=True, blank=True)
    user = models.ForeignKey(User, related_name="tasks")
    assigned_to = models.ForeignKey(User, related_name="assignments", 
                                    null=True, blank=True)
    
    
    def __unicode__(self):
        return "%s" % self.name

class TaskRecord(PersistentRecord):
    fields = ['name', 'description', 'priority', 'date_due', 'date_completed', 
              "user" ]
    
persistencejs.register(Task, TaskRecord)

class AssignedTask(Task):
    class Meta:
        proxy = True

class AssignedTaskRecord(TaskRecord):
    user_field = "assigned_to"
    fields = ['name', 'description', 'priority', 'date_due', 'date_completed']
    
persistencejs.register(AssignedTask, AssignedTaskRecord)

