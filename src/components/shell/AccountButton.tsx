export function AccountButton() {
  return (
    <button
      type="button"
      aria-label="Your account"
      className="flex size-11 items-center justify-center rounded-pill bg-ink text-cream"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
      </svg>
    </button>
  );
}
