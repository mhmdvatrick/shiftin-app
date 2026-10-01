// Shared constants and label maps (Bahasa Indonesia).

export const SKILLS = [
  { value: "barista", label: "Barista" },
  { value: "kitchen_helper", label: "Kitchen Helper" },
  { value: "cook", label: "Cook" },
  { value: "pelayan", label: "Pelayan" },
  { value: "kasir", label: "Kasir" },
  { value: "dishwasher", label: "Dishwasher" },
  { value: "runner", label: "Runner" },
] as const;

export const BUSINESS_TYPES = [
  "Coffee Shop",
  "Restoran",
  "Kafe",
  "Warung Makan",
  "Bakery",
  "Bar",
  "Catering",
  "Lainnya",
];

export function skillLabel(value: string): string {
  return SKILLS.find((s) => s.value === value)?.label ?? value;
}

// Fallbacks; real values come from GET /api/config.
export const UMK_HOURLY = 14410;
export const GEOFENCE_RADIUS_M = 100;

// Yogyakarta center (fallback location pin).
export const YOGYA_CENTER = { lat: -7.7956, lng: 110.3695 };

export const SHIFT_STATUS_LABEL: Record<string, string> = {
  taken: "Mendatang",
  checked_in: "Sedang Bekerja",
  checked_out: "Menunggu Konfirmasi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  no_show: "Tidak Hadir",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  paid: "Sudah Dibayar",
  received: "Diterima",
};
