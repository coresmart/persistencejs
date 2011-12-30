from setuptools import setup, find_packages
import os, fnmatch, sys, shutil 
import persistencejs

repos = {
    'persistencejs': {
        'destination': 'persistencejs/static/js/',
        'files': [
            'lib/persistence.js',
            'lib/persistence.store.sql.js',
            'lib/persistence.store.sqlite.js',
            'lib/persistence.store.websql.js',
            'lib/persistence.sync.js',
        ]
    },
    'datejs': {
        'destination': 'example/demo/static/js/',
        'files': ['build/date.js']
    }
}
for (dir, target) in repos.items():
    source_dir = os.path.join('repos', dir)
    target_dir = target['destination']
    print "Source directory", source_dir
    print "Target directory", target_dir
    if os.path.isdir(source_dir):
        for file in target['files']:
            _, filename = os.path.split(file)
            print "Coping", os.path.join(source_dir, file), " to ", \
                os.path.join(target_dir, filename)
            shutil.copy(os.path.join(source_dir, file), 
                        os.path.join(target_dir, filename))
    else:
        raise Exception("Source directory %s not found. Make sure you have updated the repositories folder." % source_dir)

CLASSIFIERS = [
    'Development Status :: 3 - Alpha',
    'Environment :: Web Environment',
    'Framework :: Django',
    'Intended Audience :: Developers',
    'Operating System :: OS Independent',
    'Programming Language :: Python',
]

setup(
    author="Jordan Reiter",
    author_email="jordan@aace.org",
    name='django-persistencejs',
    version=persistencejs.__version__,
    description='Server-side implementation for persistence.js in Django',
    platforms=['OS Independent'],
    classifiers=CLASSIFIERS,
    install_requires=[
        'django',
        'python-dateutil'
    ],
    packages=find_packages(exclude=["example", "example.*"]),
    package_data={
        'persistencejs': [
            'static/js/*.js',
        ],
    },
    zip_safe = False
)
