# Basic concepts shamelessly stolen from https://github.com/brosner/django-tagging/blob/master/tagging/__init__.py
from django.conf import settings

from base import PersistentRecord

class AlreadyRegistered(Exception):
    """
    An attempt was made to register a model more than once.
    """
    pass

class NotRegistered(Exception):
    """
    An attempt was made to access a model that isn't registered.
    """
    pass


#class _registry(object):
#    items = []
#    
#    def append(self, item):
#        self.items.append(item)
# 
#    def __contains__(self, model):
#        for k, v in self.items:
#            if k == model:
#                return True
#        return False
#    
#    def get(self, model):
#        for k, v in self.items:
#            if k == model:
#                return (k,v)
#        raise KeyError(model)
#
#registry = _registry()
registry = []

def register(model, persistence_class=PersistentRecord):
    """
    Sets the given model class up for working with tags.
    """

    if model in registry:
        raise AlreadyRegistered("The model '%s' has already been "
            "registered." % model._meta.object_name)

    setattr(model, 'persistence', persistence_class(model))

    registry.append(model)
    

if 'django.contrib.auth' in settings.INSTALLED_APPS:
    from django.contrib.auth.models import User
    from auth import UserRecord
    register(User, UserRecord)