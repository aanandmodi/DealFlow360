FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.lock /app/requirements.lock
RUN pip install --no-cache-dir -r requirements.lock && useradd --create-home app
COPY --chown=app:app . /app
RUN chmod +x /app/start.sh
USER app
EXPOSE 8000
CMD ["/app/start.sh"]
