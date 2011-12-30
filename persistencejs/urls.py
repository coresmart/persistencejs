from django.conf.urls.defaults import patterns, url
from views import changes, session

urlpatterns = patterns('',
    url('^(?P<app_name>\w+)/(?P<model_name>\w+)/', changes, name="persistence-changes"),
    url('^session/', session, name="persistence-session")
)
