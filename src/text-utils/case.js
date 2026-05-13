export function toUpperCase(src) {
  return src.toUpperCase();
}

export function toLowerCase(src) {
  return src.toLowerCase();
}

export function toTitleCase(src) {
  return src.replace(
    /\b\w[\w']*/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()
  );
}
