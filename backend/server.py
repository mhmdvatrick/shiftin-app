"""Shiftin backend — F&B gig marketplace (Yogyakarta MVP).

FastAPI + MongoDB (motor). JWT auth (email/password, role worker|business).
Geospatial matching via 2dsphere + $geoNear. FCFS slot claiming is atomic.
Server-side geofence validation for attendance.
"""
import os
import uuid
import math
import asyncio
import logging
import mimetypes
from pathlib import Path
from datetime import datetime, timezone, timedelta, date as date_cls
from typing import List, Optional, Literal

import jwt
import bcrypt
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

import storage as objstore

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
TOKEN_DAYS = 30

WIB = timezone(timedelta(hours=7))  # Asia/Jakarta

# ----- tunable business config -------------------------------------------------
UMK_HOURLY = 14410          # UMK Kota Yogyakarta per hour (approx) -> warning threshold
RADIUS_INITIAL_M = 3000     # initial matching radius
RADIUS_MAX_M = 5000         # max matching radius
EXPAND_AFTER_MIN = 10       # expand radius after this many minutes
GEOFENCE_RADIUS_M = 100     # check-in/out geofence
CHECKIN_WINDOW_MIN = 15     # check-in opens this many minutes before start
LATE_TOLERANCE_MIN = 10     # late if checked-in after start + tolerance
PLATFORM_FEE_PCT = 0        # 0 for MVP (fee disabled)
# ranking weights (easy to tune)
W_PROXIMITY, W_RATING, W_ATTENDANCE = 0.5, 0.3, 0.2

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("shiftin")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Shiftin API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

SKILLS = ["barista", "kitchen_helper", "cook", "pelayan", "kasir", "dishwasher", "runner"]


# ============================ helpers =========================================
def now_wib() -> datetime:
    return datetime.now(WIB)


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8")[:72], h.encode("utf-8"))
    except Exception:
        return False


def issue_token(uid: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    claims = {"sub": uid, "role": role, "iat": now, "exp": now + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG)


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def point(lat: float, lng: float) -> dict:
    return {"type": "Point", "coordinates": [lng, lat]}


def parse_iso(s: str) -> datetime:
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=WIB)
    return dt


def build_shift_dt(date_str: str, start_time: str, end_time: str):
    """Combine date + HH:MM. Supports past-midnight (end next day)."""
    d = date_cls.fromisoformat(date_str)
    sh, sm = [int(x) for x in start_time.split(":")]
    eh, em = [int(x) for x in end_time.split(":")]
    start = datetime(d.year, d.month, d.day, sh, sm, tzinfo=WIB)
    end = datetime(d.year, d.month, d.day, eh, em, tzinfo=WIB)
    if end <= start:
        end = end + timedelta(days=1)
    return start, end


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "role": u["role"],
        "name": u.get("name", ""),
        "onboarded": u.get("onboarded", False),
        "verified": u.get("verified", False),
        "blocked": u.get("blocked", False),
        "photo_url": u.get("photo_url"),
    }


async def get_current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    unauth = HTTPException(status.HTTP_401_UNAUTHORIZED, "Token tidak valid atau kedaluwarsa")
    if not cred or cred.scheme.lower() != "bearer":
        raise unauth
    try:
        claims = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise unauth
    u = await db.users.find_one({"id": claims.get("sub")}, {"_id": 0})
    if not u:
        raise unauth
    if u.get("blocked"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akun diblokir")
    return u


def require_role(role: str):
    async def dep(u: dict = Depends(get_current_user)) -> dict:
        if u["role"] != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Akses ditolak untuk peran ini")
        return u
    return dep


async def notify(user_id: str, ntype: str, title: str, body: str, data: Optional[dict] = None):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": ntype,
        "title": title,
        "body": body,
        "data": data or {},
        "read": False,
        "created_at": now_wib().isoformat(),
    })


# ============================ models ==========================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Literal["worker", "business"]
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class WorkerProfileIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    experience: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    domicile_address: Optional[str] = None
    ewallet_number: Optional[str] = None
    photo_url: Optional[str] = None
    ktp_url: Optional[str] = None
    ready_to_work: Optional[bool] = None


class BusinessProfileIn(BaseModel):
    name: Optional[str] = None
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    outlet_photo_url: Optional[str] = None
    pic_name: Optional[str] = None
    pic_contact: Optional[str] = None


class ReadyIn(BaseModel):
    ready_to_work: bool


class JobIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    skill: str
    date: str                 # YYYY-MM-DD
    start_time: str           # HH:MM
    end_time: str             # HH:MM
    hourly_rate: int = Field(ge=0)
    workers_needed: int = Field(ge=1, le=50)
    description: Optional[str] = ""


class AttendanceIn(BaseModel):
    application_id: str
    lat: float
    lng: float
    accuracy: Optional[float] = None
    is_mock: bool = False
    selfie_path: Optional[str] = None


class RatingIn(BaseModel):
    application_id: str
    stars: int = Field(ge=1, le=5)
    comment: Optional[str] = ""


# ============================ auth ============================================
@api.post("/auth/register")
async def register(data: RegisterIn):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email sudah terdaftar")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_pw(data.password),
        "role": data.role,
        "name": data.name,
        "onboarded": False,
        "verified": False,
        "blocked": False,
        "created_at": now_wib().isoformat(),
        # stats
        "rating_avg": 0.0,
        "rating_count": 0,
        "shifts_completed": 0,
        "attendance_rate": 100.0,
        "reliability_score": 100.0,
        # worker
        "skills": [],
        "ready_to_work": False,
        "location": None,
    }
    await db.users.insert_one(doc)
    return {"access_token": issue_token(uid, data.role), "user": user_public(doc)}


@api.post("/auth/login")
async def login(data: LoginIn):
    u = await db.users.find_one({"email": data.email.lower()})
    if not u or not verify_pw(data.password, u["password_hash"]):
        raise HTTPException(401, "Email atau kata sandi salah")
    if u.get("blocked"):
        raise HTTPException(403, "Akun diblokir")
    return {"access_token": issue_token(u["id"], u["role"]), "user": user_public(u)}


@api.get("/auth/me")
async def me(u: dict = Depends(get_current_user)):
    return user_public(u)


# ============================ profile =========================================
def profile_view(u: dict) -> dict:
    base = {
        "id": u["id"], "email": u["email"], "role": u["role"], "name": u.get("name", ""),
        "phone": u.get("phone"), "photo_url": u.get("photo_url"),
        "onboarded": u.get("onboarded", False), "verified": u.get("verified", False),
        "rating_avg": round(u.get("rating_avg", 0.0), 1), "rating_count": u.get("rating_count", 0),
        "lat": (u.get("location") or {}).get("coordinates", [None, None])[1] if u.get("location") else None,
        "lng": (u.get("location") or {}).get("coordinates", [None, None])[0] if u.get("location") else None,
    }
    if u["role"] == "worker":
        base.update({
            "skills": u.get("skills", []), "experience": u.get("experience", ""),
            "domicile_address": u.get("domicile_address", ""), "ewallet_number": u.get("ewallet_number", ""),
            "ktp_url": u.get("ktp_url"), "ready_to_work": u.get("ready_to_work", False),
            "shifts_completed": u.get("shifts_completed", 0),
            "attendance_rate": round(u.get("attendance_rate", 100.0)),
            "reliability_score": round(u.get("reliability_score", 100.0)),
        })
    else:
        base.update({
            "business_name": u.get("business_name", ""), "business_type": u.get("business_type", ""),
            "address": u.get("address", ""), "outlet_photo_url": u.get("outlet_photo_url"),
            "pic_name": u.get("pic_name", ""), "pic_contact": u.get("pic_contact", ""),
        })
    return base


@api.get("/profile")
async def get_profile(u: dict = Depends(get_current_user)):
    return profile_view(u)


@api.put("/profile")
async def update_profile(payload: dict, u: dict = Depends(get_current_user)):
    upd = {}
    if u["role"] == "worker":
        data = WorkerProfileIn(**payload)
    else:
        data = BusinessProfileIn(**payload)
    d = data.dict(exclude_none=True)
    lat, lng = d.pop("lat", None), d.pop("lng", None)
    upd.update(d)
    if lat is not None and lng is not None:
        upd["location"] = point(lat, lng)
    upd["onboarded"] = True
    # MVP: simulate instant admin approval once the profile (incl. KTP) is complete.
    upd["verified"] = True
    await db.users.update_one({"id": u["id"]}, {"$set": upd})
    u2 = await db.users.find_one({"id": u["id"]}, {"_id": 0})
    return profile_view(u2)


@api.put("/profile/ready")
async def set_ready(data: ReadyIn, u: dict = Depends(require_role("worker"))):
    await db.users.update_one({"id": u["id"]}, {"$set": {"ready_to_work": data.ready_to_work}})
    return {"ready_to_work": data.ready_to_work}


# ============================ uploads =========================================
@api.post("/upload")
async def upload(file: UploadFile = File(...), kind: str = Form("misc"), u: dict = Depends(get_current_user)):
    raw = await file.read()
    ext = (file.filename or "img.jpg").split(".")[-1].lower()[:5] or "jpg"
    path = f"{objstore.APP_NAME}/uploads/{u['id']}/{uuid.uuid4()}.{ext}"
    ctype = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "image/jpeg"
    try:
        await run_in_threadpool(objstore.put_object, path, raw, ctype)
    except Exception as e:
        logger.error(f"upload failed: {e}")
        raise HTTPException(502, "Gagal mengunggah berkas")
    await db.uploads.insert_one({
        "id": str(uuid.uuid4()), "path": path, "owner_id": u["id"], "kind": kind,
        "content_type": ctype, "created_at": now_wib().isoformat(),
    })
    return {"path": path, "url": f"/api/files/{path}"}


@api.get("/files/{path:path}")
async def get_file(path: str, token: Optional[str] = Query(None),
                   cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    # auth: accept bearer header OR ?token= (needed for <img> on web)
    jwt_str = cred.credentials if cred else token
    if not jwt_str:
        raise HTTPException(401, "Tidak terautentikasi")
    try:
        jwt.decode(jwt_str, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Token tidak valid")
    meta = await db.uploads.find_one({"path": path}, {"_id": 0})
    if not meta:
        raise HTTPException(404, "Berkas tidak ditemukan")
    try:
        content, ctype = await run_in_threadpool(objstore.get_object, path)
    except Exception:
        raise HTTPException(404, "Berkas tidak ditemukan")
    return Response(content=content, media_type=ctype)


# ============================ matching ========================================
async def match_and_notify(job: dict, radius_m: int, exclude_notified: bool = False):
    """Find eligible workers near the outlet and notify them in-app."""
    loc = job["outlet_location"]
    already = set(job.get("notified_workers", [])) if exclude_notified else set()
    pipeline = [
        {"$geoNear": {
            "near": loc, "distanceField": "dist_m", "maxDistance": radius_m,
            "spherical": True,
            "query": {"role": "worker", "ready_to_work": True, "verified": True,
                      "blocked": {"$ne": True}, "skills": job["skill"]},
        }},
        {"$limit": 100},
    ]
    new_ids = []
    async for w in db.users.aggregate(pipeline):
        if w["id"] in already:
            continue
        # skip workers with a time conflict
        if await has_conflict(w["id"], job["start_dt"], job["end_dt"]):
            continue
        new_ids.append(w["id"])
        await notify(
            w["id"], "new_job", "Loker baru di dekatmu!",
            f"{job['title']} • {job['skill_label']} • Rp{job['hourly_rate']:,}/jam".replace(",", "."),
            {"job_id": job["id"], "distance_m": round(w["dist_m"])},
        )
    if new_ids:
        await db.jobs.update_one({"id": job["id"]}, {"$addToSet": {"notified_workers": {"$each": new_ids}}})
    return new_ids


async def has_conflict(worker_id: str, start_iso: str, end_iso: str) -> bool:
    s, e = parse_iso(start_iso), parse_iso(end_iso)
    cur = db.applications.find({
        "worker_id": worker_id,
        "status": {"$in": ["taken", "checked_in"]},
    })
    async for a in cur:
        js = parse_iso(a["start_dt"])
        je = parse_iso(a["end_dt"])
        if s < je and js < e:  # overlap
            return True
    return False


def skill_label(s: str) -> str:
    return {
        "barista": "Barista", "kitchen_helper": "Kitchen Helper", "cook": "Cook",
        "pelayan": "Pelayan", "kasir": "Kasir", "dishwasher": "Dishwasher", "runner": "Runner",
    }.get(s, s)


# ============================ jobs (business) =================================
@api.post("/jobs")
async def create_job(data: JobIn, u: dict = Depends(require_role("business"))):
    if not u.get("location"):
        raise HTTPException(400, "Lengkapi lokasi outlet di profil terlebih dahulu")
    if data.skill not in SKILLS:
        raise HTTPException(400, "Skill tidak valid")
    start, end = build_shift_dt(data.date, data.start_time, data.end_time)
    if start.date() < now_wib().date():
        raise HTTPException(400, "Tanggal tidak boleh di masa lalu")
    hours = (end - start).total_seconds() / 3600.0
    fee = round(data.hourly_rate * hours * data.workers_needed * PLATFORM_FEE_PCT / 100)
    jid = str(uuid.uuid4())
    coords = u["location"]["coordinates"]
    job = {
        "id": jid,
        "business_id": u["id"],
        "business_name": u.get("business_name", u.get("name", "Bisnis")),
        "outlet_address": u.get("address", ""),
        "outlet_photo_url": u.get("outlet_photo_url"),
        "outlet_location": u["location"],
        "outlet_lat": coords[1],
        "outlet_lng": coords[0],
        "title": data.title,
        "skill": data.skill,
        "skill_label": skill_label(data.skill),
        "date": data.date,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "start_dt": start.isoformat(),
        "end_dt": end.isoformat(),
        "planned_hours": round(hours, 2),
        "hourly_rate": data.hourly_rate,
        "workers_needed": data.workers_needed,
        "slots_filled": 0,
        "description": data.description or "",
        "status": "open",
        "platform_fee": fee,
        "estimated_total_per_worker": round(data.hourly_rate * hours),
        "current_radius_m": RADIUS_INITIAL_M,
        "geofence_radius_m": GEOFENCE_RADIUS_M,
        "notified_workers": [],
        "created_at": now_wib().isoformat(),
        "deleted_at": None,
    }
    await db.jobs.insert_one(job)
    await match_and_notify(job, RADIUS_INITIAL_M)
    job.pop("_id", None)
    job.pop("notified_workers", None)
    return job


@api.get("/jobs/business")
async def business_jobs(tab: str = "active", u: dict = Depends(require_role("business"))):
    q = {"business_id": u["id"], "deleted_at": None}
    if tab == "active":
        q["status"] = {"$in": ["open", "filled"]}
    elif tab == "ongoing":
        q["status"] = "ongoing"
    elif tab == "completed":
        q["status"] = {"$in": ["completed", "cancelled"]}
    out = []
    async for j in db.jobs.find(q, {"_id": 0, "notified_workers": 0}).sort("start_dt", 1):
        j["checked_in_count"] = await db.applications.count_documents(
            {"job_id": j["id"], "status": {"$in": ["checked_in"]}})
        out.append(j)
    return out


@api.get("/jobs/{jid}/applications")
async def job_applications(jid: str, u: dict = Depends(require_role("business"))):
    job = await db.jobs.find_one({"id": jid, "business_id": u["id"]}, {"_id": 0, "notified_workers": 0})
    if not job:
        raise HTTPException(404, "Loker tidak ditemukan")
    apps = []
    async for a in db.applications.find({"job_id": jid}, {"_id": 0}).sort("taken_at", 1):
        w = await db.users.find_one({"id": a["worker_id"]}, {"_id": 0})
        dist = None
        if w and w.get("location"):
            c = w["location"]["coordinates"]
            dist = round(haversine_m(job["outlet_lat"], job["outlet_lng"], c[1], c[0]))
        apps.append({
            **a,
            "worker": {
                "id": w["id"], "name": w.get("name"), "photo_url": w.get("photo_url"),
                "rating_avg": round(w.get("rating_avg", 0.0), 1),
                "shifts_completed": w.get("shifts_completed", 0),
                "distance_m": dist,
            } if w else None,
        })
    return {"job": job, "applications": apps}


@api.post("/jobs/{jid}/cancel")
async def cancel_job(jid: str, u: dict = Depends(require_role("business"))):
    job = await db.jobs.find_one({"id": jid, "business_id": u["id"]})
    if not job:
        raise HTTPException(404, "Loker tidak ditemukan")
    if job["status"] in ("completed", "cancelled"):
        raise HTTPException(400, "Loker sudah selesai/dibatalkan")
    last_minute = (parse_iso(job["start_dt"]) - now_wib()) < timedelta(hours=2)
    await db.jobs.update_one({"id": jid}, {"$set": {
        "status": "cancelled",
        "cancelled_at": now_wib().isoformat(),
        "cancel_last_minute": last_minute,
    }})
    async for a in db.applications.find({"job_id": jid, "status": {"$in": ["taken", "checked_in"]}}):
        await db.applications.update_one({"id": a["id"]}, {"$set": {"status": "cancelled"}})
        await notify(a["worker_id"], "job_cancelled", "Loker dibatalkan",
                     f"{job['title']} telah dibatalkan oleh bisnis.", {"job_id": jid})
    return {"ok": True, "cancel_last_minute": last_minute}


# ============================ jobs (worker) ===================================
@api.get("/jobs/nearby")
async def nearby_jobs(
    skill: Optional[str] = None,
    date: Optional[str] = None,
    max_distance: Optional[int] = None,
    min_rate: Optional[int] = None,
    u: dict = Depends(require_role("worker")),
):
    if not u.get("location"):
        raise HTTPException(400, "Lengkapi lokasi domisili di profil terlebih dahulu")
    maxd = min(max_distance or RADIUS_MAX_M, RADIUS_MAX_M)
    match_q = {"status": "open", "deleted_at": None, "$expr": {"$lt": ["$slots_filled", "$workers_needed"]}}
    if skill:
        match_q["skill"] = skill
    if date:
        match_q["date"] = date
    if min_rate:
        match_q["hourly_rate"] = {"$gte": min_rate}
    pipeline = [
        {"$geoNear": {"near": u["location"], "distanceField": "dist_m",
                      "maxDistance": maxd, "spherical": True, "query": match_q}},
        {"$limit": 60},
    ]
    taken = set()
    async for a in db.applications.find({"worker_id": u["id"], "status": {"$in": ["taken", "checked_in", "checked_out", "completed"]}}):
        taken.add(a["job_id"])
    out = []
    now = now_wib()
    async for j in db.jobs.aggregate(pipeline):
        if j["dist_m"] > j.get("current_radius_m", RADIUS_MAX_M):
            continue
        if j["id"] in taken:
            continue
        if parse_iso(j["end_dt"]) < now:
            continue
        out.append({
            "id": j["id"], "title": j["title"], "skill": j["skill"], "skill_label": j["skill_label"],
            "business_name": j["business_name"], "outlet_address": j["outlet_address"],
            "outlet_photo_url": j.get("outlet_photo_url"),
            "date": j["date"], "start_time": j["start_time"], "end_time": j["end_time"],
            "hourly_rate": j["hourly_rate"], "planned_hours": j["planned_hours"],
            "estimated_total": j["estimated_total_per_worker"],
            "workers_needed": j["workers_needed"], "slots_filled": j["slots_filled"],
            "distance_m": round(j["dist_m"]),
        })
    return out


@api.get("/jobs/{jid}")
async def job_detail(jid: str, u: dict = Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid}, {"_id": 0, "notified_workers": 0})
    if not j:
        raise HTTPException(404, "Loker tidak ditemukan")
    res = dict(j)
    res["estimated_total"] = j["estimated_total_per_worker"]
    if u["role"] == "worker" and u.get("location"):
        c = u["location"]["coordinates"]
        res["distance_m"] = round(haversine_m(j["outlet_lat"], j["outlet_lng"], c[1], c[0]))
    myapp = await db.applications.find_one({"job_id": jid, "worker_id": u["id"]}, {"_id": 0})
    res["my_application"] = myapp
    res["slots_left"] = j["workers_needed"] - j["slots_filled"]
    return res


@api.post("/jobs/{jid}/take")
async def take_shift(jid: str, u: dict = Depends(require_role("worker"))):
    if not u.get("verified"):
        raise HTTPException(403, "Akun belum terverifikasi admin")
    job = await db.jobs.find_one({"id": jid})
    if not job or job["status"] != "open" or job.get("deleted_at"):
        raise HTTPException(400, "Loker tidak tersedia")
    if await db.applications.find_one({"job_id": jid, "worker_id": u["id"]}):
        raise HTTPException(409, "Kamu sudah mengambil shift ini")
    if await has_conflict(u["id"], job["start_dt"], job["end_dt"]):
        raise HTTPException(409, "Kamu punya shift lain yang bentrok di jam ini")
    # ---- atomic FCFS slot claim (prevents race on the last slot) ----
    claimed = await db.jobs.find_one_and_update(
        {"id": jid, "status": "open", "$expr": {"$lt": ["$slots_filled", "$workers_needed"]}},
        {"$inc": {"slots_filled": 1}},
        return_document=True,
    )
    if not claimed:
        raise HTTPException(409, "Slot sudah penuh")
    aid = str(uuid.uuid4())
    app_doc = {
        "id": aid, "job_id": jid, "worker_id": u["id"], "business_id": job["business_id"],
        "worker_name": u.get("name"), "skill": job["skill"],
        "start_dt": job["start_dt"], "end_dt": job["end_dt"],
        "hourly_rate": job["hourly_rate"],
        "status": "taken", "taken_at": now_wib().isoformat(),
        "check_in": None, "check_out": None,
        "actual_minutes": None, "wage_amount": None, "late": False,
        "business_confirmed": False, "payment_status": "pending",
        "worker_rated": False, "business_rated": False,
    }
    await db.applications.insert_one(app_doc)
    # mark job filled if quota reached (claimed is the post-increment doc)
    if claimed["slots_filled"] >= claimed["workers_needed"]:
        await db.jobs.update_one({"id": jid}, {"$set": {"status": "filled"}})
    await notify(job["business_id"], "slot_filled", "Slot terisi!",
                 f"{u.get('name')} mengambil shift '{job['title']}'.", {"job_id": jid})
    app_doc.pop("_id", None)
    return app_doc


# ============================ my shifts (worker) ==============================
@api.get("/applications/mine")
async def my_applications(tab: str = "upcoming", u: dict = Depends(require_role("worker"))):
    q = {"worker_id": u["id"]}
    if tab == "upcoming":
        q["status"] = "taken"
    elif tab == "ongoing":
        q["status"] = "checked_in"
    else:  # history
        q["status"] = {"$in": ["checked_out", "completed", "cancelled", "no_show"]}
    out = []
    async for a in db.applications.find(q, {"_id": 0}).sort("start_dt", -1 if tab == "history" else 1):
        job = await db.jobs.find_one({"id": a["job_id"]}, {"_id": 0})
        if job:
            a["job"] = {
                "title": job["title"], "business_name": job["business_name"],
                "outlet_address": job["outlet_address"], "skill_label": job["skill_label"],
                "outlet_lat": job["outlet_lat"], "outlet_lng": job["outlet_lng"],
                "geofence_radius_m": job["geofence_radius_m"], "date": job["date"],
                "start_time": job["start_time"], "end_time": job["end_time"],
            }
        out.append(a)
    return out


@api.get("/applications/{aid}")
async def application_detail(aid: str, u: dict = Depends(get_current_user)):
    a = await db.applications.find_one({"id": aid}, {"_id": 0})
    if not a or (u["id"] not in (a["worker_id"], a["business_id"])):
        raise HTTPException(404, "Data tidak ditemukan")
    job = await db.jobs.find_one({"id": a["job_id"]}, {"_id": 0, "notified_workers": 0})
    a["job"] = job
    return a


# ============================ attendance ======================================
def _validate_geo(job: dict, lat: float, lng: float, is_mock: bool):
    if is_mock:
        raise HTTPException(400, "Lokasi palsu (mock) terdeteksi. Matikan mock location.")
    dist = haversine_m(job["outlet_lat"], job["outlet_lng"], lat, lng)
    if dist > job["geofence_radius_m"]:
        raise HTTPException(400, f"Kamu berada {round(dist)} m dari outlet. Mendekatlah ke lokasi (maks {job['geofence_radius_m']} m).")
    return dist


@api.post("/attendance/checkin")
async def check_in(data: AttendanceIn, u: dict = Depends(require_role("worker"))):
    a = await db.applications.find_one({"id": data.application_id, "worker_id": u["id"]})
    if not a:
        raise HTTPException(404, "Shift tidak ditemukan")
    if a["status"] != "taken":
        raise HTTPException(400, "Shift tidak dapat check-in")
    job = await db.jobs.find_one({"id": a["job_id"]})
    start = parse_iso(a["start_dt"])
    now = now_wib()
    if now < start - timedelta(minutes=CHECKIN_WINDOW_MIN):
        raise HTTPException(400, f"Check-in dibuka {CHECKIN_WINDOW_MIN} menit sebelum jam mulai.")
    dist = _validate_geo(job, data.lat, data.lng, data.is_mock)
    late = now > start + timedelta(minutes=LATE_TOLERANCE_MIN)
    rec = {
        "time": now.isoformat(), "lat": data.lat, "lng": data.lng,
        "accuracy": data.accuracy, "distance_m": round(dist),
        "selfie_path": data.selfie_path, "is_mock": data.is_mock,
    }
    await db.applications.update_one({"id": a["id"]}, {"$set": {
        "status": "checked_in", "check_in": rec, "late": late,
    }})
    await db.jobs.update_one({"id": job["id"], "status": {"$in": ["filled", "open"]}},
                             {"$set": {"status": "ongoing"}})
    await notify(a["business_id"], "attendance", "Pekerja hadir",
                 f"{u.get('name')} telah check-in" + (" (terlambat)" if late else "."), {"job_id": job["id"]})
    return {"ok": True, "late": late, "distance_m": round(dist)}


@api.post("/attendance/checkout")
async def check_out(data: AttendanceIn, u: dict = Depends(require_role("worker"))):
    a = await db.applications.find_one({"id": data.application_id, "worker_id": u["id"]})
    if not a:
        raise HTTPException(404, "Shift tidak ditemukan")
    if a["status"] != "checked_in":
        raise HTTPException(400, "Kamu belum check-in")
    job = await db.jobs.find_one({"id": a["job_id"]})
    dist = _validate_geo(job, data.lat, data.lng, data.is_mock)
    now = now_wib()
    ci = parse_iso(a["check_in"]["time"])
    minutes = max(0, round((now - ci).total_seconds() / 60))
    wage = round(minutes / 60 * a["hourly_rate"])
    rec = {
        "time": now.isoformat(), "lat": data.lat, "lng": data.lng,
        "accuracy": data.accuracy, "distance_m": round(dist),
        "selfie_path": data.selfie_path, "is_mock": data.is_mock,
    }
    await db.applications.update_one({"id": a["id"]}, {"$set": {
        "status": "checked_out", "check_out": rec,
        "actual_minutes": minutes, "wage_amount": wage,
    }})
    await notify(a["business_id"], "attendance", "Pekerja selesai",
                 f"{u.get('name')} telah check-out. Konfirmasi jam kerja.", {"application_id": a["id"]})
    return {"ok": True, "actual_minutes": minutes, "wage_amount": wage}


# ============================ confirm + ratings + payments ====================
@api.post("/applications/{aid}/confirm")
async def confirm_hours(aid: str, u: dict = Depends(require_role("business"))):
    a = await db.applications.find_one({"id": aid, "business_id": u["id"]})
    if not a:
        raise HTTPException(404, "Data tidak ditemukan")
    if a["status"] not in ("checked_out",):
        raise HTTPException(400, "Belum bisa dikonfirmasi")
    await db.applications.update_one({"id": aid}, {"$set": {
        "status": "completed", "business_confirmed": True, "payment_status": "pending",
    }})
    await db.users.update_one({"id": a["worker_id"]}, {"$inc": {"shifts_completed": 1}})
    await db.payments_log.insert_one({
        "id": str(uuid.uuid4()), "application_id": aid, "worker_id": a["worker_id"],
        "business_id": u["id"], "amount": a.get("wage_amount", 0), "status": "pending",
        "created_at": now_wib().isoformat(),
    })
    await notify(a["worker_id"], "work_confirmed", "Jam kerja dikonfirmasi",
                 f"Upah Rp{a.get('wage_amount',0):,} menunggu pembayaran.".replace(",", "."),
                 {"application_id": aid})
    return {"ok": True}


@api.post("/applications/{aid}/mark-paid")
async def mark_paid(aid: str, u: dict = Depends(require_role("business"))):
    a = await db.applications.find_one({"id": aid, "business_id": u["id"]})
    if not a:
        raise HTTPException(404, "Data tidak ditemukan")
    await db.applications.update_one({"id": aid}, {"$set": {"payment_status": "paid"}})
    await db.payments_log.update_one({"application_id": aid}, {"$set": {"status": "paid", "paid_at": now_wib().isoformat()}})
    await notify(a["worker_id"], "payment", "Pembayaran dikirim",
                 f"Bisnis menandai upah Rp{a.get('wage_amount',0):,} sudah dibayar. Konfirmasi penerimaan.".replace(",", "."),
                 {"application_id": aid})
    return {"ok": True}


@api.post("/applications/{aid}/confirm-received")
async def confirm_received(aid: str, u: dict = Depends(require_role("worker"))):
    a = await db.applications.find_one({"id": aid, "worker_id": u["id"]})
    if not a:
        raise HTTPException(404, "Data tidak ditemukan")
    await db.applications.update_one({"id": aid}, {"$set": {"payment_status": "received"}})
    await db.payments_log.update_one({"application_id": aid}, {"$set": {"status": "received"}})
    return {"ok": True}


@api.post("/ratings")
async def rate(data: RatingIn, u: dict = Depends(get_current_user)):
    a = await db.applications.find_one({"id": data.application_id})
    if not a or (u["id"] not in (a["worker_id"], a["business_id"])):
        raise HTTPException(404, "Data tidak ditemukan")
    if a["status"] != "completed":
        raise HTTPException(400, "Shift belum selesai")
    is_business = u["id"] == a["business_id"]
    target = a["worker_id"] if is_business else a["business_id"]
    flag = "business_rated" if is_business else "worker_rated"
    if a.get(flag):
        raise HTTPException(409, "Kamu sudah memberi nilai")
    await db.ratings.insert_one({
        "id": str(uuid.uuid4()), "application_id": data.application_id, "job_id": a["job_id"],
        "from_user": u["id"], "to_user": target, "from_role": u["role"],
        "stars": data.stars, "comment": data.comment or "", "created_at": now_wib().isoformat(),
    })
    await db.applications.update_one({"id": a["id"]}, {"$set": {flag: True}})
    # recompute target rating
    agg = db.ratings.aggregate([
        {"$match": {"to_user": target}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "n": {"$sum": 1}}},
    ])
    doc = await agg.to_list(1)
    if doc:
        await db.users.update_one({"id": target}, {"$set": {
            "rating_avg": doc[0]["avg"], "rating_count": doc[0]["n"]}})
    return {"ok": True}


# ============================ wallet ==========================================
@api.get("/wallet")
async def wallet(u: dict = Depends(require_role("worker"))):
    pending, paid, items = 0, 0, []
    async for a in db.applications.find(
        {"worker_id": u["id"], "status": "completed"}, {"_id": 0}).sort("end_dt", -1):
        amt = a.get("wage_amount", 0) or 0
        if a["payment_status"] == "pending":
            pending += amt
        else:
            paid += amt
        job = await db.jobs.find_one({"id": a["job_id"]}, {"_id": 0})
        items.append({
            "application_id": a["id"], "amount": amt, "payment_status": a["payment_status"],
            "title": job["title"] if job else "", "business_name": job["business_name"] if job else "",
            "date": job["date"] if job else "", "actual_minutes": a.get("actual_minutes"),
        })
    return {"pending_total": pending, "paid_total": paid, "items": items}


# ============================ notifications ===================================
@api.get("/notifications")
async def list_notifications(u: dict = Depends(get_current_user)):
    out = []
    async for n in db.notifications.find({"user_id": u["id"]}, {"_id": 0}).sort("created_at", -1).limit(100):
        out.append(n)
    return out


@api.get("/notifications/unread-count")
async def unread_count(u: dict = Depends(get_current_user)):
    return {"count": await db.notifications.count_documents({"user_id": u["id"], "read": False})}


@api.post("/notifications/read-all")
async def read_all(u: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": u["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ============================ favorites (business) ============================
@api.get("/favorites")
async def list_favorites(u: dict = Depends(require_role("business"))):
    out = []
    async for f in db.favorites.find({"business_id": u["id"]}, {"_id": 0}):
        w = await db.users.find_one({"id": f["worker_id"]}, {"_id": 0})
        if w:
            out.append({"id": w["id"], "name": w.get("name"), "photo_url": w.get("photo_url"),
                        "rating_avg": round(w.get("rating_avg", 0.0), 1),
                        "skills": w.get("skills", []), "shifts_completed": w.get("shifts_completed", 0)})
    return out


@api.post("/favorites/{worker_id}")
async def add_favorite(worker_id: str, u: dict = Depends(require_role("business"))):
    await db.favorites.update_one(
        {"business_id": u["id"], "worker_id": worker_id},
        {"$set": {"business_id": u["id"], "worker_id": worker_id, "created_at": now_wib().isoformat()}},
        upsert=True)
    return {"ok": True}


@api.delete("/favorites/{worker_id}")
async def remove_favorite(worker_id: str, u: dict = Depends(require_role("business"))):
    await db.favorites.delete_one({"business_id": u["id"], "worker_id": worker_id})
    return {"ok": True}


@api.get("/config")
async def get_config():
    return {
        "umk_hourly": UMK_HOURLY, "radius_initial_m": RADIUS_INITIAL_M, "radius_max_m": RADIUS_MAX_M,
        "geofence_radius_m": GEOFENCE_RADIUS_M, "checkin_window_min": CHECKIN_WINDOW_MIN,
        "skills": [{"value": s, "label": skill_label(s)} for s in SKILLS],
        "platform_fee_pct": PLATFORM_FEE_PCT,
    }


@api.get("/")
async def root():
    return {"app": "Shiftin", "status": "ok"}


# ============================ background: radius expansion =====================
async def radius_expander():
    """Periodically widen matching radius 3km -> 5km for stale open jobs."""
    while True:
        try:
            cutoff = (now_wib() - timedelta(minutes=EXPAND_AFTER_MIN)).isoformat()
            async for j in db.jobs.find({"status": "open", "deleted_at": None,
                                         "current_radius_m": {"$lt": RADIUS_MAX_M},
                                         "created_at": {"$lte": cutoff}}):
                await db.jobs.update_one({"id": j["id"]}, {"$set": {"current_radius_m": RADIUS_MAX_M}})
                j["current_radius_m"] = RADIUS_MAX_M
                await match_and_notify(j, RADIUS_MAX_M, exclude_notified=True)
        except Exception as e:
            logger.error(f"radius_expander: {e}")
        await asyncio.sleep(60)


# ============================ seed demo data ==================================
async def seed():
    if await db.users.count_documents({}) > 0:
        return
    logger.info("Seeding demo data...")
    biz_id = str(uuid.uuid4())
    biz = {
        "id": biz_id, "email": "bisnis@shiftin.id", "password_hash": hash_pw("password123"),
        "role": "business", "name": "Andi Pratama", "onboarded": True, "verified": True,
        "blocked": False, "created_at": now_wib().isoformat(),
        "business_name": "Kopi Senja", "business_type": "Coffee Shop",
        "address": "Jl. Malioboro No. 10, Yogyakarta", "pic_name": "Andi", "pic_contact": "08123456789",
        "location": point(-7.7925, 110.3659), "rating_avg": 4.6, "rating_count": 12,
        "outlet_photo_url": None,
    }
    await db.users.insert_one(biz)

    workers = [
        ("Budi Santoso", "budi@shiftin.id", ["barista", "pelayan"], (-7.7828, 110.3671), 4.8, 96),
        ("Siti Aminah", "siti@shiftin.id", ["kasir", "pelayan"], (-7.7889, 110.3700), 4.5, 92),
        ("Eko Wijaya", "eko@shiftin.id", ["kitchen_helper", "dishwasher"], (-7.8011, 110.3644), 4.2, 88),
        ("Rina Lestari", "rina@shiftin.id", ["barista", "runner"], (-7.7760, 110.3750), 4.9, 99),
    ]
    worker_ids = []
    for name, email, skills, (lat, lng), rating, att in workers:
        wid = str(uuid.uuid4())
        worker_ids.append(wid)
        await db.users.insert_one({
            "id": wid, "email": email, "password_hash": hash_pw("password123"),
            "role": "worker", "name": name, "onboarded": True, "verified": True, "blocked": False,
            "created_at": now_wib().isoformat(), "skills": skills, "experience": "2 tahun di F&B",
            "domicile_address": "Yogyakarta", "ewallet_number": "0812-0000-0000",
            "ready_to_work": True, "location": point(lat, lng),
            "rating_avg": rating, "rating_count": 10, "shifts_completed": 24,
            "attendance_rate": att, "reliability_score": att, "photo_url": None, "ktp_url": None,
        })

    # two open jobs for the business
    for title, skl, days_ahead, st, et, rate, need in [
        ("Butuh tambahan Barista", "barista", 0, "17:00", "22:00", 20000, 2),
        ("Pelayan untuk acara", "pelayan", 1, "10:00", "16:00", 18000, 3),
    ]:
        d = (now_wib() + timedelta(days=days_ahead)).date().isoformat()
        start, end = build_shift_dt(d, st, et)
        hours = (end - start).total_seconds() / 3600
        jid = str(uuid.uuid4())
        await db.jobs.insert_one({
            "id": jid, "business_id": biz_id, "business_name": "Kopi Senja",
            "outlet_address": "Jl. Malioboro No. 10, Yogyakarta", "outlet_photo_url": None,
            "outlet_location": point(-7.7925, 110.3659), "outlet_lat": -7.7925, "outlet_lng": 110.3659,
            "title": title, "skill": skl, "skill_label": skill_label(skl), "date": d,
            "start_time": st, "end_time": et, "start_dt": start.isoformat(), "end_dt": end.isoformat(),
            "planned_hours": round(hours, 2), "hourly_rate": rate, "workers_needed": need,
            "slots_filled": 0, "description": "Shift ramah, lingkungan kerja menyenangkan.",
            "status": "open", "platform_fee": 0, "estimated_total_per_worker": round(rate * hours),
            "current_radius_m": RADIUS_MAX_M, "geofence_radius_m": GEOFENCE_RADIUS_M,
            "notified_workers": [], "created_at": now_wib().isoformat(), "deleted_at": None,
        })
    logger.info("Seed complete.")


# ============================ startup =========================================
app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index([("location", "2dsphere")])
    await db.jobs.create_index([("outlet_location", "2dsphere")])
    await db.applications.create_index("worker_id")
    await db.applications.create_index("job_id")
    await db.notifications.create_index("user_id")
    try:
        await run_in_threadpool(objstore.init_storage)
    except Exception as e:
        logger.error(f"storage init failed: {e}")
    await seed()
    asyncio.create_task(radius_expander())


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
