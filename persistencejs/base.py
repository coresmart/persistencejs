import datetime
import dateutil.parser

from django.forms import ModelForm
from django.core.exceptions import FieldError, ObjectDoesNotExist, PermissionDenied
from django.core.urlresolvers import reverse

from django.db import models

from utils import datetime_to_unix, unix_to_datetime

def get_js_field_type(fld):
    if isinstance(fld, (models.CharField, models.TextField, 
                        models.URLField, models.EmailField, 
                        models.SlugField, models.XMLField)):
        return PersistentText
    elif isinstance(fld, (models.BigIntegerField, models.IntegerField, 
                          models.PositiveIntegerField, 
                          models.PositiveSmallIntegerField)):
        return PersistentInteger
    elif isinstance(fld, (models.BooleanField, models.NullBooleanField)):
        return PersistentBoolean
    elif isinstance(fld, (models.DateField, models.DateTimeField)):
        return PersistentDateTime
    elif isinstance(fld, (models.ForeignKey)):
        return PersistentForeignKey
    else:
        raise Exception("Error handling field %s: I don't know how to handle fields of type"
                        " %s" % (fld.name, fld.__class__.__name__))


class PersistentType(object):
    def __init__(self, jst):
        self.js_type = jst
    
    def __unicode__(self):
        return u'%s' % self.js_type

PersistentText = PersistentType('TEXT')
PersistentInteger = PersistentType('INT')
PersistentDateTime = PersistentType('DATE')
PersistentBoolean = PersistentType('BOOL')
PersistentForeignKey = PersistentType('TEXT')


class PersistentRecord(object):
    id_field = "guid"
    modified_field = "date_modified"
    deleted_field = "date_deleted"
    created_field = "date_created"
    read_only = False
    
    def __init__(self, model=None):
        if model:
            self.model = model
        self.field_types = {}
        self.initialize_fields()

    def initialize_fields(self):
        """
        If not provided, create self.fields.
        Then, make sure that all fields actually exist, 
        and remove special fields from the fields list
        """
        if not hasattr(self, 'fields'):
            self.fields = [ fld.name for fld in self.get_model()._meta.fields 
                           if fld.name not in [ self.id_field, 
                                               self.modified_field, 
                                               self.deleted_field, 
                                               self.created_field ] 
                           ] 
        bad_fields = []
        for fname in self.fields:
            try:
                fld, _, _, _ = self.get_model()._meta.get_field_by_name(fname)
                self.field_types[fname]=get_js_field_type(fld)
            except models.FieldDoesNotExist:
                bad_fields.append(fname)
        if bad_fields:
            raise FieldError("Unknown field(s) (%s) specified for %s "
                "persistence record" % (" ,".join(bad_fields),
                self.get_model()._meta.object_name)
            )
        if not hasattr(self, "user_field"):
            if "user" in self.fields:
                self.user_field = "user"

    def __unicode__(self):
        return u"""
var %(model_name)s = persistence.define('%(model_name)s', {
%(fields)s
});
""" % {
          "model_name": self.get_model()._meta.object_name,
          "fields": ",\n".join([u'%(name)s: "%(type)s"' % fld for fld in 
                                self.get_js_fields() if fld['type'] != PersistentForeignKey]),
    }

    def get_js_record(self, record):
        return "new %(model_name)s({%(fields)s})" % {
            "model_name": self.get_model()._meta.object_name,
            "fields": ",\n".join([u'%(name)s: %(value)s' % fld for fld in self.get_js_record_fields(record) if self.field_types[fld] != PersistentForeignKey])
        }

    def get_js_fields(self):
        return [self.get_js_field(fld) for fld in self.fields]
    
    def get_js_field(self, fld):
        return {"name": fld, "type": self.field_types[fld]}
    

    def get(self, id):
        record = self.get_model().objects.get(**{ self.id_field: id })
        return record

    def get_model(self):
        try:
            return self.model
        except AttributeError:
            raise Exception("Model not provided for this PersistentRecord.")

    def newer(self, since=None):
        records = []
        for r in self.get_newer_records(since):
            record = {
                'id': getattr(r, self.id_field),
                '_lastChange': datetime_to_unix(getattr(r, self.modified_field or self.created_field))
            }
            record.update(dict([(k, self.convert_field_to_js(k, getattr(r,k))) for k in self.fields]))
            if self.deleted_field and getattr(r, self.deleted_field, False):
                record['_removed'] = True
            records.append(record)
        return records

    def get_newer_records(self, since=None):
        if since == None:
            return None
        try:
            since = unix_to_datetime(since)
        except TypeError:
            pass #assume it's already a datetime
        created = self.get_model().objects.filter(**{ "%s__gte" % self.created_field: since })
        updated = self.get_model().objects.filter(**{ "%s__gte" % self.modified_field: since })
        results = created | updated
        if self.deleted_field:
            deleted = self.get_model().objects.deleted().filter(**{ "%s__gte" % self.deleted_field: since })
            results |= deleted
        return results

    def update(self, updates, now=None, user=None, protect_records=True, ignore_missing=True):
        if hasattr(self, 'user_field') and not user.is_authenticated():
            raise PermissionDenied("Must be logged in in order to update these records.")
        if not now:
            now = datetime.datetime.now()
        for update in updates:
            if update.get('_removed'):
                try:
                    self.remove_record(update, now=now, user=user, protect_record=protect_records)
                except ObjectDoesNotExist:
                    if not ignore_missing:
                        raise
            else:
                self.update_record(update, now=now, user=user, protect_record=protect_records)

    def remove_record(self, update, now=None, user=None, protect_record=True):
        record = self.get(update['id'])
        try:
            record_user = getattr(record, self.user_field)
            if record_user and record_user != user and protect_record:
                raise PermissionDenied("This record was created by another user, so it can't be deleted.")
        except ObjectDoesNotExist:
            pass
        record.delete()


    def update_record(self, update, now=None, user=None, protect_record=True):
        try:
            record = self.get(update['id'])
        except ObjectDoesNotExist:
            record = self.get_model()()
            setattr(record, self.id_field, update['id'])
            if user and getattr(self, 'user_field'):
                setattr(record, self.user_field, user)
            else:
                pass
        try:
            record_user = getattr(record, self.user_field)
            if record_user and record_user != user and protect_record:
                raise PermissionDenied("This record was created by another user, so it can't be modified.")
        except ObjectDoesNotExist:
            pass
        for field, value in update.items():
            self.update_record_field(record, field, value, user=user)
        setattr(record, self.modified_field, now)
        record.save()

    def update_record_field(self, record, field, value, user=None):
        if field in ["id", self.id_field, self.modified_field]:
            pass # ignore these fields
        elif field == getattr(self, 'user_field'):
            if user and not getattr(record, self.user_field):
                setattr(record, self.user_field, user)
        elif self.field_types[field] == PersistentForeignKey:
            try:
                foreign_persist = record._meta.get_field_by_name(field)[0].related.parent_model.persistence
                foreign_record = foreign_persist.get(value)
                if not (hasattr(record, field) and getattr(record, field) == foreign_record):
                    setattr(record, field, foreign_record)
            except Exception, inst:
                raise Exception("Error handling foreign key value during sync: %s" % repr(inst))
        elif field not in self.fields:
            pass # ignore this field; we're not using it
        else:
            setattr(record, field, self.convert_js_to_field(field, value))

    def convert_field_to_js(self, field, value):
        ftype = self.field_types[field]
        if ftype == PersistentDateTime:
            return datetime_to_unix(value)
        elif ftype == PersistentBoolean:
            return (value == True)
        elif ftype == PersistentForeignKey:
            try:
                return getattr(value, value.persistence.id_field)
            except Exception, inst:
                raise Exception("Invalid specification: you specified a foreign key to a model that doesn't have a persistent record: %s, %s" %
                                (repr(value), inst)
                                )
        else:
            return value

    def convert_js_to_field(self, field, value):
        ftype = self.field_types[field]
        if ftype == PersistentDateTime:
            if value:
                try:
                    rslt = unix_to_datetime(value)
                except:
                    rslt = dateutil.parser.parse(value)
                return rslt
                raise Exception("changed %s to %s" % (repr(value), repr(rslt)))
        if ftype == PersistentForeignKey:
            return "%s" % value
        else:
            return value
    
    @property
    def url(self):
        return reverse("persistence-changes", kwargs = {
            'app_name': self.get_model()._meta.app_label,
            'model_name': self.get_model()._meta.object_name
        })


class ReadOnlyPersistentRecord(PersistentRecord):
    read_only = True

    def update(self, *args, **kwargs):
        return None # read only persistent records can't be modified by persistence'