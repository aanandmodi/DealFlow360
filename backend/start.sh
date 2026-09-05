#!/bin/sh
set -e
echo "Running database migrations..."
python manage.py migrate --no-input
echo "Collecting static files..."
python manage.py collectstatic --no-input --clear
echo "Starting gunicorn..."
exec gunicorn dealflow360.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --error-logfile - \
    --access-logfile -
