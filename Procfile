release: python manage.py migrate
web: web: python manage.py collectstatic --noinput && gunicorn spotshare.wsgi
worker: celery -A spotshare worker --loglevel=info