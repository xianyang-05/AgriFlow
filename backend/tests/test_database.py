from app.database import normalize_database_url


def test_normalize_database_url_keeps_explicit_psycopg_driver():
    url = "postgresql+psycopg://user:pass@host:6543/postgres"

    assert normalize_database_url(url) == url


def test_normalize_database_url_converts_plain_postgresql_scheme():
    url = "postgresql://user:pass@host:6543/postgres"

    assert normalize_database_url(url) == "postgresql+psycopg://user:pass@host:6543/postgres"


def test_normalize_database_url_converts_postgres_alias():
    url = "postgres://user:pass@host:6543/postgres"

    assert normalize_database_url(url) == "postgresql+psycopg://user:pass@host:6543/postgres"
