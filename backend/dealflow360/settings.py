"""
Django settings for DealFlow360 project.
"""
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

try:
    import dj_database_url
except ImportError:
    dj_database_url = None

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / '.env')

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-dev-key-change-me')
DEBUG = os.getenv('DJANGO_DEBUG', 'False').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = [h.strip() for h in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()] + ['testserver']
render_host = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if render_host and render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_host)

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    # Project apps
    'core',
    'quotations',
    'fulfillment',
    'billing',
    'portal',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
]
try:
    import whitenoise  # noqa: F401
    MIDDLEWARE.append('whitenoise.middleware.WhiteNoiseMiddleware')
except ImportError:
    pass

MIDDLEWARE.extend([
    'core.middleware.PrivateAPIHeaders',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
])

ROOT_URLCONF = 'dealflow360.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'dealflow360.wsgi.application'

# Explicit database selection; production never silently changes databases.
DATABASE_URL = os.getenv('DATABASE_URL')
USE_SQLITE = os.getenv('USE_SQLITE', '0' if (DATABASE_URL or not DEBUG) else '1').lower() in ('1', 'true', 'yes')

if DATABASE_URL and dj_database_url:
    DATABASES = {
        'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=True)
    }
elif USE_SQLITE:
    if not DEBUG and not DATABASE_URL:
        raise RuntimeError('Production requires PostgreSQL or DATABASE_URL (USE_SQLITE=0).')
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('POSTGRES_DB', 'dealflow360'),
            'USER': os.getenv('POSTGRES_USER', 'dealflow360'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', ''),
            'HOST': os.getenv('POSTGRES_HOST', '127.0.0.1'),
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
        }
    }
DATABASES['default']['ATOMIC_REQUESTS'] = True

# Auth
AUTH_USER_MODEL = 'core.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
try:
    import whitenoise  # noqa: F401
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
except ImportError:
    pass

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'URL_FORMAT_OVERRIDE': None,
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle', 'rest_framework.throttling.UserRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {'anon': '20/min', 'user': '300/min'},
}

# Simple JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        minutes=int(os.getenv('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', '15'))
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=int(os.getenv('JWT_REFRESH_TOKEN_LIFETIME_DAYS', '7'))
    ),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS & CSRF
cors_origins = [h.strip() for h in os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if h.strip()]
frontend_url = os.getenv('FRONTEND_URL', 'https://deal-flow360-omega.vercel.app').strip()
if 'dealflow360.vercel.app' in frontend_url:
    frontend_url = 'https://deal-flow360-omega.vercel.app'
if frontend_url and frontend_url not in cors_origins:
    cors_origins.append(frontend_url)
CORS_ALLOWED_ORIGINS = cors_origins
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.vercel\.app$",
]
CORS_ALLOW_CREDENTIALS = True

# Portal
PORTAL_MAGIC_LINK_EXPIRY_HOURS = int(os.getenv('PORTAL_MAGIC_LINK_EXPIRY_HOURS', '24'))

# Dashboard config
STALLED_DEAL_THRESHOLD_DAYS = 14
DISCOUNT_ANOMALY_THRESHOLD_PCT = 5.0

FRONTEND_URL = frontend_url
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'no-referrer'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
X_FRAME_OPTIONS = 'DENY'
if not DEBUG and (SECRET_KEY.startswith('django-insecure') or len(SECRET_KEY) < 50):
    raise RuntimeError('Set a strong DJANGO_SECRET_KEY before production startup.')

# Reverse proxy TLS header
if os.getenv('TRUST_PROXY', '0') == '1' or os.getenv('RENDER_EXTERNAL_HOSTNAME'):
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
DATA_UPLOAD_MAX_MEMORY_SIZE = 1048576
REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = ['rest_framework.renderers.JSONRenderer']

# Shared throttling across production workers. Redis has no public port.
if os.getenv('REDIS_URL'):
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': os.environ['REDIS_URL']}}

CSRF_TRUSTED_ORIGINS = [o for o in cors_origins if o.startswith(('http://', 'https://'))]
if render_host:
    CSRF_TRUSTED_ORIGINS.append(f'https://{render_host}')
CSRF_TRUSTED_ORIGINS.append('https://*.vercel.app')

AUTH_PASSWORD_VALIDATORS[1]['OPTIONS'] = {'min_length': 10}

if not DEBUG and not DATABASE_URL and not USE_SQLITE and len(os.getenv('POSTGRES_PASSWORD', '')) < 16:
    raise RuntimeError('Production requires a database password of at least 16 characters.')
if os.getenv('TRUST_PROXY') == '1':
    REST_FRAMEWORK['NUM_PROXIES'] = 1
