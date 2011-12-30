from django.conf.urls.defaults import patterns, include, url

from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',
    url(r'^admin/', include(admin.site.urls)),
    url(r'^sync/', include("persistencejs.urls")),
    url(r'^demo/', 'demo.views.demo', name='demo_page'),
)
