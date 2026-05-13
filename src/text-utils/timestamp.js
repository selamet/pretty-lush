export function timestampToIso(src) {
  const t = src.trim();
  if (!/^\d+$/.test(t)) throw new Error("Expected a unix timestamp (integer)");
  const n = Number(t);
  // 10 digits = seconds, 13 = milliseconds, 16 = microseconds.
  let ms;
  if (t.length >= 16) ms = Math.floor(n / 1000);
  else if (t.length >= 13) ms = n;
  else ms = n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) throw new Error("Timestamp out of range");
  return d.toISOString();
}

export function isoToTimestamp(src) {
  const d = new Date(src.trim());
  if (Number.isNaN(d.getTime()))
    throw new Error("Could not parse as an ISO date");
  return String(Math.floor(d.getTime() / 1000));
}
