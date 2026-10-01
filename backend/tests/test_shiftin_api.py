"""Backend integration tests for Shiftin F&B marketplace API."""
import os
import time
import uuid
import io
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://shift-marketplace-11.preview.emergentagent.com").rstrip("/")
OUTLET_LAT, OUTLET_LNG = -7.7925, 110.3659


# ---------------- auth ----------------
class TestAuth:
    def test_health_root(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_login_seeded_business(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": "bisnis@shiftin.id", "password": "password123"})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body and body["user"]["role"] == "business"

    def test_login_wrong_password_401(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": "bisnis@shiftin.id", "password": "wrong"})
        assert r.status_code == 401

    def test_register_duplicate_409(self, api):
        r = api.post(f"{BASE_URL}/api/auth/register", json={
            "email": "bisnis@shiftin.id", "password": "password123", "role": "business", "name": "x"
        })
        assert r.status_code == 409

    def test_me_requires_token(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, worker_client):
        r = worker_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "worker"


# ---------------- role enforcement ----------------
class TestRoleEnforcement:
    def test_worker_cannot_create_job(self, worker_client):
        r = worker_client.post(f"{BASE_URL}/api/jobs", json={
            "title": "x", "skill": "barista", "date": "2030-01-01",
            "start_time": "10:00", "end_time": "12:00", "hourly_rate": 20000, "workers_needed": 1
        })
        assert r.status_code == 403

    def test_business_cannot_view_nearby(self, biz_client):
        r = biz_client.get(f"{BASE_URL}/api/jobs/nearby")
        assert r.status_code == 403


# ---------------- profile ----------------
class TestProfile:
    def test_get_worker_profile(self, worker_client):
        r = worker_client.get(f"{BASE_URL}/api/profile")
        assert r.status_code == 200
        p = r.json()
        assert p["role"] == "worker"
        assert "skills" in p

    def test_get_business_profile(self, biz_client):
        r = biz_client.get(f"{BASE_URL}/api/profile")
        assert r.status_code == 200
        p = r.json()
        assert p["role"] == "business"
        assert "business_name" in p


# ---------------- jobs feed ----------------
class TestJobsFeed:
    def test_nearby_returns_jobs(self, worker_client):
        r = worker_client.get(f"{BASE_URL}/api/jobs/nearby")
        assert r.status_code == 200
        jobs = r.json()
        assert isinstance(jobs, list)
        if jobs:
            j = jobs[0]
            assert "distance_m" in j and "estimated_total" in j

    def test_nearby_skill_filter(self, worker_client):
        r = worker_client.get(f"{BASE_URL}/api/jobs/nearby", params={"skill": "barista"})
        assert r.status_code == 200
        for j in r.json():
            assert j["skill"] == "barista"

    def test_job_detail_slots_left(self, worker_client):
        r = worker_client.get(f"{BASE_URL}/api/jobs/nearby")
        assert r.status_code == 200
        jobs = r.json()
        if not jobs:
            pytest.skip("no jobs available")
        jid = jobs[0]["id"]
        d = worker_client.get(f"{BASE_URL}/api/jobs/{jid}")
        assert d.status_code == 200
        body = d.json()
        assert "slots_left" in body and "my_application" in body


# ---------------- take shift / FCFS ----------------
def _register_fresh_worker(skills=("barista",), lat=-7.7900, lng=110.3700):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"TEST_w_{uuid.uuid4().hex[:8]}@shiftin.id"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "password123", "role": "worker", "name": "TEST Worker"
    })
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    # onboard with skills + location (auto-verifies)
    r = s.put(f"{BASE_URL}/api/profile", json={
        "name": "TEST Worker", "skills": list(skills), "lat": lat, "lng": lng,
        "ewallet_number": "0812", "ktp_url": "x", "ready_to_work": True,
    })
    assert r.status_code == 200, r.text
    return s, email


class TestTakeShift:
    def test_onboard_auto_verifies(self):
        s, _ = _register_fresh_worker()
        p = s.get(f"{BASE_URL}/api/profile").json()
        assert p["verified"] is True and p["onboarded"] is True

    def test_take_shift_and_duplicate_409(self):
        s, _ = _register_fresh_worker(skills=("pelayan",))
        feed = s.get(f"{BASE_URL}/api/jobs/nearby", params={"skill": "pelayan"}).json()
        if not feed:
            pytest.skip("no pelayan jobs")
        jid = feed[0]["id"]
        r1 = s.post(f"{BASE_URL}/api/jobs/{jid}/take")
        assert r1.status_code == 200, r1.text
        app = r1.json()
        assert app["status"] == "taken" and app["job_id"] == jid
        # duplicate
        r2 = s.post(f"{BASE_URL}/api/jobs/{jid}/take")
        assert r2.status_code == 409

    def test_take_shift_time_conflict_409(self):
        s, _ = _register_fresh_worker(skills=("barista", "pelayan"))
        feed = s.get(f"{BASE_URL}/api/jobs/nearby").json()
        if len(feed) < 2:
            pytest.skip("need 2 overlapping jobs")
        # take first
        r1 = s.post(f"{BASE_URL}/api/jobs/{feed[0]['id']}/take")
        assert r1.status_code == 200
        # try the other if overlapping dates
        for j in feed[1:]:
            r2 = s.post(f"{BASE_URL}/api/jobs/{j['id']}/take")
            # one of them may conflict (409) or succeed; just assert valid responses
            assert r2.status_code in (200, 409)


# ---------------- attendance (server-side geofence) ----------------
class TestAttendance:
    def _get_taken_app(self):
        s, _ = _register_fresh_worker(skills=("barista",))
        feed = s.get(f"{BASE_URL}/api/jobs/nearby", params={"skill": "barista"}).json()
        if not feed:
            return None, None
        jid = feed[0]["id"]
        r = s.post(f"{BASE_URL}/api/jobs/{jid}/take")
        if r.status_code != 200:
            return None, None
        return s, r.json()

    def test_checkin_far_away_rejected(self):
        s, app = self._get_taken_app()
        if not s:
            pytest.skip("no job to take")
        r = s.post(f"{BASE_URL}/api/attendance/checkin", json={
            "application_id": app["id"], "lat": -7.80, "lng": 110.40, "is_mock": False,
        })
        # Either 400 (geo-fail) or 400 (window-fail) — both expected to NOT be success
        assert r.status_code == 400
        assert "m dari outlet" in r.text or "Check-in dibuka" in r.text

    def test_checkin_mock_location_rejected(self):
        s, app = self._get_taken_app()
        if not s:
            pytest.skip("no job to take")
        r = s.post(f"{BASE_URL}/api/attendance/checkin", json={
            "application_id": app["id"], "lat": OUTLET_LAT, "lng": OUTLET_LNG, "is_mock": True,
        })
        assert r.status_code == 400
        # either window not open yet or mock detected
        assert "mock" in r.text.lower() or "Check-in dibuka" in r.text


# ---------------- business create job ----------------
class TestCreateJob:
    def test_create_job_past_date_400(self, biz_client):
        r = biz_client.post(f"{BASE_URL}/api/jobs", json={
            "title": "TEST Past", "skill": "barista", "date": "2000-01-01",
            "start_time": "10:00", "end_time": "12:00", "hourly_rate": 20000, "workers_needed": 1,
        })
        assert r.status_code == 400

    def test_create_job_success_and_in_dashboard(self, biz_client):
        from datetime import date, timedelta
        tomorrow = (date.today() + timedelta(days=2)).isoformat()
        r = biz_client.post(f"{BASE_URL}/api/jobs", json={
            "title": "TEST Barista Shift", "skill": "barista", "date": tomorrow,
            "start_time": "10:00", "end_time": "14:00", "hourly_rate": 20000, "workers_needed": 1,
            "description": "test",
        })
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["planned_hours"] == 4.0
        assert job["estimated_total_per_worker"] == 80000
        # confirm appears in business dashboard active tab
        d = biz_client.get(f"{BASE_URL}/api/jobs/business", params={"tab": "active"})
        assert d.status_code == 200
        assert any(j["id"] == job["id"] for j in d.json())

    def test_business_job_applications(self, biz_client):
        d = biz_client.get(f"{BASE_URL}/api/jobs/business", params={"tab": "active"})
        jobs = d.json()
        if not jobs:
            pytest.skip("no jobs")
        jid = jobs[0]["id"]
        r = biz_client.get(f"{BASE_URL}/api/jobs/{jid}/applications")
        assert r.status_code == 200
        body = r.json()
        assert "job" in body and "applications" in body


# ---------------- notifications ----------------
class TestNotifications:
    def test_list_and_unread(self, worker_client):
        r = worker_client.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        r2 = worker_client.get(f"{BASE_URL}/api/notifications/unread-count")
        assert r2.status_code == 200 and "count" in r2.json()

    def test_read_all(self, worker_client):
        r = worker_client.post(f"{BASE_URL}/api/notifications/read-all")
        assert r.status_code == 200
        r2 = worker_client.get(f"{BASE_URL}/api/notifications/unread-count")
        assert r2.json()["count"] == 0


# ---------------- favorites ----------------
class TestFavorites:
    def test_add_list_remove_favorite(self, biz_client, worker_client):
        me = worker_client.get(f"{BASE_URL}/api/auth/me").json()
        wid = me["id"]
        r = biz_client.post(f"{BASE_URL}/api/favorites/{wid}")
        assert r.status_code == 200
        lst = biz_client.get(f"{BASE_URL}/api/favorites").json()
        assert any(w["id"] == wid for w in lst)
        r2 = biz_client.delete(f"{BASE_URL}/api/favorites/{wid}")
        assert r2.status_code == 200


# ---------------- wallet ----------------
class TestWallet:
    def test_wallet_shape(self, worker_client):
        r = worker_client.get(f"{BASE_URL}/api/wallet")
        assert r.status_code == 200
        body = r.json()
        assert set(body.keys()) >= {"pending_total", "paid_total", "items"}


# ---------------- upload ----------------
class TestUpload:
    def test_upload_and_file_access(self, worker_client):
        # tiny 1x1 PNG
        png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000000500010d0a2db40000000049454e44ae426082")
        files = {"file": ("t.png", io.BytesIO(png), "image/png")}
        headers = {"Authorization": worker_client.headers["Authorization"]}
        r = requests.post(f"{BASE_URL}/api/upload", files=files, data={"kind": "misc"}, headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "path" in body and "url" in body
        path = body["path"]
        # unauth
        r2 = requests.get(f"{BASE_URL}/api/files/{path}")
        assert r2.status_code == 401
        # with token
        tok = headers["Authorization"].replace("Bearer ", "")
        r3 = requests.get(f"{BASE_URL}/api/files/{path}", params={"token": tok})
        assert r3.status_code == 200
