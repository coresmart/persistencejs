import sys

from django.conf import settings

class FileSessionMiddleware(object):
    def process_request(self, request):
        sys.stdout.write("Running session middleware")
        if not request.COOKIES.has_key(settings.SESSION_COOKIE_NAME) \
            and request.GET.has_key(settings.SESSION_COOKIE_NAME):
            sys.stdout.write("Setting the cookie")
            request.COOKIES[settings.SESSION_COOKIE_NAME] = \
                request.GET[settings.SESSION_COOKIE_NAME]