FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.lock /app/requirements.lock
RUN pip install --no-cache-dir -r requirements.lock && useradd --create-home app
COPY --chown=app:app . /app
USER app
EXPOSE 8000
CMD ["gunicorn", "dealflow360.wsgi:application", "--bind", "0.0.0.0:$PORT", "--workers", "2", "--threads", "4", "--timeout", "120", "--error-logfile", "-"]
