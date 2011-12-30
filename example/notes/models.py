from django.db import models
from django.contrib.auth.models import User

import persistencejs
from persistencejs.base import PersistentRecord
from persistencejs.models import PersistentModel

from tasks.models import Task

# Create your models here.
class Note(PersistentModel):
    subject = models.CharField(max_length=100)
    content = models.TextField(blank=True)
    user = models.ForeignKey(User, related_name="notes")
    task = models.ForeignKey(Task, related_name="notes")

    def __unicode__(self):
        return "%s" % self.subject

class NoteRecord(PersistentRecord):
    fields = ["subject", "content", "user", "task", "date_created"]
persistencejs.register(Note, NoteRecord)