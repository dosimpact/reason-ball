import os

from flask_caching.backends.rediscache import RedisCache


def env(name: str, default: str) -> str:
    return os.environ.get(name, default)


REDIS_HOST = env("REDIS_HOST", "superset-cache")
REDIS_PORT = int(env("REDIS_PORT", "6379"))

SECRET_KEY = env("SUPERSET_SECRET_KEY", "dev-only-change-this-secret-key")
SQLALCHEMY_DATABASE_URI = env(
    "SQLALCHEMY_DATABASE_URI",
    "postgresql+psycopg2://superset:superset@superset-db:5432/superset",
)

# Redis-backed caches keep chart/dashboard interactions closer to the way a real
# Superset deployment behaves than the default in-memory cache.
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_cache_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": 1,
}
DATA_CACHE_CONFIG = CACHE_CONFIG
FILTER_STATE_CACHE_CONFIG = CACHE_CONFIG
EXPLORE_FORM_DATA_CACHE_CONFIG = CACHE_CONFIG

RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST,
    port=REDIS_PORT,
    db=2,
    key_prefix="superset_results_",
)


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    imports = (
        "superset.sql_lab",
        "superset.tasks.cache",
        "superset.tasks.scheduler",
    )
    worker_prefetch_multiplier = 1
    task_acks_late = True


CELERY_CONFIG = CeleryConfig

# Alert/report delivery needs SMTP or Slack credentials and a headless browser.
# Keep disabled for the baseline onboarding stack.
FEATURE_FLAGS = {
    "ALERT_REPORTS": False,
}

WEBDRIVER_BASEURL = "http://superset-app:8088"
WEBDRIVER_BASEURL_USER_FRIENDLY = "http://localhost:8088"
