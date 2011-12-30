import sys
import json, datetime

from django.db.models import get_model
from django.http import HttpResponse, Http404, HttpResponseBadRequest, HttpResponseForbidden, HttpResponseNotAllowed, HttpResponseServerError 
from django.views.decorators.csrf import csrf_exempt
from django.core.exceptions import PermissionDenied
from django.conf import settings

from django.contrib.auth import login
from django.contrib.auth.forms import AuthenticationForm
import django.contrib.auth.views

from utils import request_to_data, unix_to_datetime, datetime_to_unix

@csrf_exempt
def changes(request, app_name=None, model_name=None):
    try:
        model = get_model(app_name, model_name)
    except:
        raise Http404("Model matching request not found.")
    try:
        persistent_record = model.persistence
    except AttributeError:
        raise Exception("The model '%s' is not registered or does not have a " 
            "persistence object." %  model._meta.object_name)
    now =  datetime.datetime.now()
    if request.method == 'POST':
        try:
            updates = request_to_data(request)
        except ValueError:
            return HttpResponseBadRequest("JSON data expected.")
        try:
            persistent_record.update(updates, now=now, user=request.user)
            resp = HttpResponse(json.dumps({
                "status": "ok",
                "now": datetime_to_unix(now) * 1000
                }), content_type="application/json")
        except PermissionDenied, inst:
            resp = HttpResponseForbidden("%s" % inst)
        except Exception, inst:
            resp = HttpResponseServerError("An error occurred: %s (%s)" % (inst, type(inst)))
    elif request.method == 'GET':
        try:
            since = unix_to_datetime(float(request.GET['since'])/1000.0)
        except (KeyError, ValueError), inst:
            return HttpResponseBadRequest("Must provide a value for since in "
                                          "Unix timestamp format: %s" % inst)
        updates = persistent_record.newer(since)
        resp = HttpResponse(json.dumps({
            "now": datetime_to_unix(now) * 1000,
            "updates": updates or []
        }), content_type="application/json")
    elif request.method == 'OPTIONS':
        resp = HttpResponse()
        resp["Allow"] = "GET,POST"
    else:
        resp = HttpResponseNotAllowed(["GET", "POST"])
    resp['Access-Control-Allow-Origin'] = "*"
    resp['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept"
    return resp

@csrf_exempt
def session(request, LoginForm=AuthenticationForm):
    if request.method == 'POST':
        # assuming authentication
        form = LoginForm(data=request.POST)
        if form.is_valid():
            login(request, form.get_user())
        else:
            sys.stdout.write("\n%s" % repr(request.POST))
            sys.stdout.write("\nthe errors are")
            sys.stdout.write("\nErrors [%s]" % str(form.errors))
            resp = HttpResponseForbidden(json.dumps({
                'session_key_name': settings.SESSION_COOKIE_NAME,
                'session_key': request.session.session_key,
                'errors': dict(form.errors.items())
            }))
            resp['Location'] = settings.LOGIN_URL
    elif not request.user.is_authenticated():
        form = LoginForm()
        resp = HttpResponseForbidden(json.dumps({
            'session_key_name': settings.SESSION_COOKIE_NAME,
            'session_key': request.session.session_key,
            'form': """
<form method="POST" action="">%s
<p><input type="submit" /></p>
</form>
            """ % form.as_p(), 
            'method': request.method
        }))
        resp['Location'] = settings.LOGIN_URL
    if request.user.is_authenticated():
        resp = HttpResponse(json.dumps({
            'session_key_name': settings.SESSION_COOKIE_NAME,
            'session_key': request.session.session_key,
            'user': {
                'username': request.user.username,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
                'email': request.user.email
            }
        }))
    resp['Access-Control-Allow-Origin'] = "*"
    resp['Access-Control-Allow-Headers'] = "Origin, X-Requested-With, Content-Type, Accept"
    return resp
