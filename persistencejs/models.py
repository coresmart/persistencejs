print "start of persistence models"
import uuid, datetime

from django.db import models

class PersistentModelManager(models.Manager):
    def all(self):
        return super(PersistentModelManager, self).filter(date_deleted__isnull=True)

    def deleted(self):
        return super(PersistentModelManager, self).filter(date_deleted__isnull=False)
    
    def filter(self, *args, **kwargs):
        return self.all().filter(*args, **kwargs)
    
    def exclude(self, *args, **kwargs):
        return self.all().exclude(*args, **kwargs)

class PersistentModel(models.Model):
    guid = models.CharField(max_length=36, unique=True)
    date_created = models.DateTimeField()
    date_modified = models.DateTimeField(null=True, blank=True)
    date_deleted = models.DateTimeField(null=True, blank=True)
    
    objects = PersistentModelManager()
    
    class Meta:
        abstract = True
    
    def delete(self):
        self.date_deleted = datetime.datetime.now()
        self.save()
    
    def save(self, *args, **kwargs):
        if not self.guid:
            self.guid = str(uuid.uuid4())
        if self.pk and not self.date_deleted:
            self.date_modified = datetime.datetime.now()
        if not self.date_created:
            self.date_created = datetime.datetime.now()
        super(PersistentModel, self).save(*args, **kwargs)



print "end of persistence models"