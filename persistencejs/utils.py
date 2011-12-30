import datetime, time
import json


def unix_to_datetime(ut):
    if ut == None:
        return None
    if ut > 1000000000000:
        ut = ut / 1000.0
    return datetime.datetime.fromtimestamp(float(ut))

def datetime_to_unix(dt):
    if not dt:
        return None
    return time.mktime(dt.timetuple()) * 1000.0

def request_to_data(request):
    try:
        return json.load(request)
    except AttributeError:
        raise Exception("Invalid value for request -- must be a request object.")
    except ValueError:
        raise ValueError("JSON data expected.")