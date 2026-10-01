import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://shift-marketplace-11.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def login_as(api, email, password="password123"):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    tok = r.json()["access_token"]
    api.headers.update({"Authorization": f"Bearer {tok}"})
    return r.json()


@pytest.fixture
def biz_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    login_as(s, "bisnis@shiftin.id")
    return s


@pytest.fixture
def worker_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    login_as(s, "budi@shiftin.id")
    return s
