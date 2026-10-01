// Rupiah and Indonesian date/time formatting helpers.

export function rupiah(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return "Rp" + n.toLocaleString("id-ID");
}

export function distanceLabel(meters: number | null | undefined): string {
  if (meters == null) return "-";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function formatDate(iso: string): string {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export function timeRange(start: string, end: string): string {
  return `${start} - ${end} WIB`;
}

export function minutesToHours(min: number | null | undefined): string {
  if (!min) return "0 jam";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} mnt`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} mnt`;
}
