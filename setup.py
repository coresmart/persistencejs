import urllib
from distutils.core import setup

setup(name='django-persistencejs',
    version='0.1.1',
    requires=['python-dateutil'],
    data_files=[
                ('example/demo/static/js', ['repos/datejs/build/date.js']),
                ('persistencejs/static/js', [
                    'repos/persistencejs/lib/persistence.js',
                    'repos/persistencejs/lib/persistence.store.sql.js',
                    'repos/persistencejs/lib/persistence.store.sqlite.js',
                    'repos/persistencejs/lib/persistence.store.websql.js',
                    'repos/persistencejs/lib/persistence.sync.js',
                    ])
                
                ],
    packages=['persistencejs'])
