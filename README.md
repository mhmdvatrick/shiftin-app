# Shiftin — Marketplace Kerja Paruh Waktu F&B (Yogyakarta)

Aplikasi mobile dua peran (**Pekerja** & **Bisnis**) untuk mencari dan mengisi shift kerja F&B. Dibangun dengan **Expo (React Native)** + **FastAPI** + **MongoDB**.

```
/app
├── backend/     → API FastAPI (server.py, storage.py, tests/)
├── frontend/    → Aplikasi Expo (expo-router, src/)
└── memory/      → PRD.md & test_credentials.md
```

---

## 1. Prasyarat

| Kebutuhan | Versi yang dipakai |
|---|---|
| Python | 3.11+ |
| Node.js | 20+ (dipakai: 24) |
| Yarn | 1.22.x (**wajib Yarn, bukan npm**) |
| MongoDB | 6+ (lokal atau Atlas) |
| Expo Go (di HP) | versi terbaru dari Play Store / App Store |

---

## 2. Menjalankan Backend (FastAPI)

```bash
cd backend

# 1) Buat & aktifkan virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2) Install dependensi
pip install -r requirements.txt

# 3) Buat file .env (lihat contoh di bawah)

# 4) Jalankan server
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Contoh `backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=shiftin
JWT_SECRET=ganti-dengan-string-acak-yang-panjang
EMERGENT_LLM_KEY=<kunci Emergent untuk Object Storage — opsional saat lokal>
```

Catatan:
- Semua endpoint berada di bawah prefix **`/api`** (contoh: `http://localhost:8001/api/auth/login`).
- Dokumentasi API otomatis: `http://localhost:8001/docs`.
- Saat pertama kali dijalankan dengan database kosong, backend **otomatis mengisi data demo** (1 bisnis "Kopi Senja" + 4 pekerja + 2 loker di sekitar Yogyakarta).
- Index geospasial (`2dsphere`) dibuat otomatis saat startup.
- Jika `EMERGENT_LLM_KEY` tidak diisi, fitur unggah foto (selfie/KTP/outlet) tidak akan berfungsi; fitur lain tetap jalan.

---

## 3. Menjalankan Frontend (Expo)

```bash
cd frontend

# 1) Install dependensi (gunakan Yarn!)
yarn install

# 2) Buat file .env (lihat contoh di bawah)

# 3) Jalankan Metro bundler
yarn start
```

Contoh `frontend/.env`:

```env
# URL backend TANPA akhiran /api (klien menambahkannya sendiri)
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.10:8001
```

> Gunakan **IP LAN komputer** (bukan `localhost`) agar HP yang menjalankan Expo Go bisa mengakses backend. Pastikan HP dan komputer berada di jaringan Wi-Fi yang sama.

Setelah Metro berjalan:
- Tekan **`a`** → buka di emulator Android
- Tekan **`i`** → buka di simulator iOS (hanya macOS)
- Tekan **`w`** → buka di browser (web preview)
- **Scan QR code** dengan aplikasi Expo Go di HP

Perintah lain:

```bash
yarn android   # langsung buka Android
yarn ios       # langsung buka iOS
yarn web       # langsung buka web
yarn lint      # cek lint
```

---

## 4. Akun Demo

Semua akun demo memakai password **`password123`**.

| Peran | Email | Keterangan |
|---|---|---|
| Bisnis | `bisnis@shiftin.id` | Kopi Senja, Malioboro — punya 2 loker aktif |
| Pekerja | `budi@shiftin.id` | barista, pelayan |
| Pekerja | `siti@shiftin.id` | kasir, pelayan |
| Pekerja | `eko@shiftin.id` | kitchen_helper, dishwasher |
| Pekerja | `rina@shiftin.id` | barista, runner |

Detail lengkap ada di `memory/test_credentials.md`.

---

## 5. Menjalankan Test Backend

Test memanggil API yang sedang berjalan, jadi **backend harus aktif terlebih dahulu**.

```bash
cd backend
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 pytest tests/ -v
```

---

## 6. Catatan Penting

- **Geolokasi, kamera, dan peta** (presensi check-in/out, selfie, mini-map) paling baik diuji di **HP asli lewat Expo Go**. Di web preview, peta memakai fallback dan GPS bergantung pada izin browser.
- Geofence presensi: **100 m** dari outlet; check-in dibuka 15 menit sebelum shift mulai. Akun pekerja demo berada ±3 km dari outlet — untuk mencoba check-in, gunakan fitur mock location atau buat loker baru di dekat posisi Anda.
- Jika web preview gagal memanggil API (CORS), pastikan frontend dan `EXPO_PUBLIC_BACKEND_URL` berada di origin yang sama atau akses dari Expo Go.
- Jangan ubah `metro.config.js` dan field `main` di `package.json`.

---

## 7. Troubleshooting Cepat

| Gejala | Solusi |
|---|---|
| `KeyError: 'MONGO_URL'` saat start backend | File `backend/.env` belum dibuat / variabel kosong |
| HP tidak bisa login, "Network request failed" | `EXPO_PUBLIC_BACKEND_URL` masih `localhost` — ganti ke IP LAN komputer |
| Upload foto gagal | `EMERGENT_LLM_KEY` belum diisi di `backend/.env` |
| Metro error setelah ganti `.env` | Hentikan Metro lalu jalankan `yarn start -c` (bersihkan cache) |
| Data demo tidak muncul | Database sudah berisi user; kosongkan DB (`db.dropDatabase()`) lalu restart backend |
