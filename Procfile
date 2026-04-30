release: python manage.py migrate
web: gunicorn spotshare.wsgi
worker: celery -A spotshare worker --loglevel=info