from django.shortcuts import render
from tasks.models import Task
from notes.models import Note
from django.contrib.auth.models import User

def demo(request, template_name="demo.html"):
    tasks = Task.objects.all()
    notes = Note.objects.all()
    ctx = locals()
    ctx['Task'] = Task
    ctx['Note'] = Note
    ctx['User'] = User
    return render(request, template_name, locals())