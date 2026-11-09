// The Pretty Lush mark: a leaf cut by one straight line ("lush" + tidy code).
// Colors come from CSS tokens so it follows the light / dark theme.
export default function BrandMark({ size = 28 }) {
  return (
    <svg
      className="brand-mark-svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="6.5" className="bm-bg" />
      <path
        d="M5.5 18.5C5.5 10.5 10.5 5.5 18.5 5.5C18.5 13.5 13.5 18.5 5.5 18.5Z"
        className="bm-leaf"
      />
      <path
        d="M5.5 18.5L13.6 10.4"
        className="bm-rib"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
