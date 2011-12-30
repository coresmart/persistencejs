# Basic concepts shamelessly stolen from https://github.com/brosner/django-tagging/blob/master/tagging/__init__.py

VERSION = (2, 1, 0, 'beta3')
if VERSION[-1] != "final": # pragma: no cover
    __version__ = '.'.join(map(str, VERSION))
else: # pragma: no cover
    __version__ = '.'.join(map(str, VERSION[:-1]))

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

registry = []

def register(model, persistence_class=None):
    """
    Sets the given model class up for working with tags.
    """
    if persistence_class == None:
        from base import PersistentRecord
        persistence_class = PersistentRecord

    if model in registry:
        raise AlreadyRegistered("The model '%s' has already been "
            "registered." % model._meta.object_name)

    setattr(model, 'persistence', persistence_class(model))

    registry.append(model)
    
try:
    from django.conf import settings
    if 'django.contrib.auth' in settings.INSTALLED_APPS:
        from django.contrib.auth.models import User
        from auth import UserRecord
        register(User, UserRecord)
except ImportError:
    pass 