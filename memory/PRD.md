# Shiftin — PRD & Build Log

## Original Problem Statement
MVP marketplace tenaga kerja paruh waktu (gig/on-demand) untuk sektor F&B di Indonesia (kota pertama: Yogyakarta), terinspirasi Instawork. Pemilik kafe/resto memposting kebutuhan karyawan; sistem mencocokkan pekerja terdekat; pekerja wajib check-in/out di lokasi (GPS + selfie) sebagai bukti kerja. Satu aplikasi dua peran (Pekerja/Bisnis). Fitur: auth & profil, buat loker + matching radius 3→5km + FCFS, feed loker + ambil shift, shift saya, presensi geofence, konfirmasi jam + rating dua arah, dompet (menunggu/dibayar), notifikasi, admin verifikasi.

## Tech Stack (adapted to platform)
- **Frontend**: Expo (React Native) + expo-router, @tanstack/react-query, react-native-maps (native), expo-location, expo-camera, expo-image-picker, phosphor-react-native, reanimated. Theme: light+dark warm amber (Material You expressive).
- **Backend**: FastAPI + MongoDB (motor). Geospatial 2dsphere + $geoNear for matching. JWT (bearer, email+password). bcrypt hashing.
- **Storage**: Emergent Managed Object Storage (private, token-gated `/api/files`).
- **Auth**: Email + password JWT (role worker|business). OTP/phone deferred.
- **Notifications**: In-app notification center. Push (FCM) deferred.
- **Payments**: Manual status tracking (pending/paid/received). Payment gateway deferred.

## User Personas
1. **Pekerja (Worker)** — mahasiswa/pekerja lepas F&B Jogja; ingin shift fleksibel dekat domisili, upah jelas, presensi mudah.
2. **Pemilik Bisnis (Business)** — kafe/resto butuh staf pengganti/tambahan cepat dengan pekerja terverifikasi terdekat.

## Core Requirements (static)
- Role chosen at registration; one role per account.
- Matching: skill + verified + ready + no time conflict; radius 3km→5km (pg_cron-equivalent background task), rank 0.5 proximity + 0.3 rating + 0.2 attendance.
- FCFS slot claim must be race-safe (atomic).
- Geofence validated server-side (100m), check-in window 15 min before start, late flag, mock-location rejection.
- Wage = actual minutes × rate; business confirms hours; two-way 1-5 rating.
- Bahasa Indonesia default; big buttons; ≤3 taps to take a shift.

## Implemented (2026-10-01)
- Auth: register/login/me, JWT bearer, role enforcement (403), bcrypt.
- Onboarding worker & business (skills, location pin via expo-location, photo/KTP/outlet upload → object storage). Auto-verify on completion (MVP simulates admin KTP approval).
- Worker: nearby feed ($geoNear, distance + estimated earnings), skill filter chips, pull-to-refresh, ready toggle, job detail + sticky "Ambil Shift", Shift Saya (mendatang/berlangsung/riwayat), Wallet (pending/paid + confirm received), Profile (rating/shifts/attendance), Notifications.
- Business: dashboard (Aktif/Berjalan/Selesai) + FAB, Buat Loker (skill/date chips, time, rate with UMK Jogja warning, workers stepper, cost summary, past-date validation, past-midnight support), Job detail (worker list + real-time attendance status), Konfirmasi Jam Kerja, Beri Nilai, Batalkan Loker, Favorit workers, Notifications.
- Attendance: check-in/out screen with mini-map (native react-native-maps / web fallback), live GPS distance, geofence banner, selfie capture, server-side validation.
- Matching + in-app notifications on job create; background radius expander (3→5km after 10 min).
- Seed demo data (business Kopi Senja + 4 workers + 2 open jobs near Yogyakarta).
- 25 backend pytest passing; storage uploads working; FCFS verified race-safe.

## Backlog
### P1
- OTP/phone login (Supabase/Firebase) ; admin web dashboard for manual KTP/business verification & account blocking.
- Shift reminders (in-app H-1 & 2 jam sebelum), check-in/out reminders.
- Reliability score decay on no-show/last-minute cancel (schema present; wire the decrement).
### P2 (phase 2 per brief)
- Payment gateway (Xendit/Midtrans — QRIS, e-wallet, escrow) via PaymentService interface.
- Push notifications (FCM) after build.
- In-app chat, insurance, automated e-KYC.

## Next Tasks
- Favorite-worker direct invite to new shift.
- Live attendance map for business.
- Wire reliability-score penalties for no-show/late-cancel.

## Notes
- Preview must run on same origin as EXPO_PUBLIC_BACKEND_URL (browser CORS). On device (Expo Go) no CORS issue.
- Attendance (GPS + selfie) & maps are best validated on a real device via Expo Go, not the web preview.
- Demo accounts in /app/memory/test_credentials.md (password123).
