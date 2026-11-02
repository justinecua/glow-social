const SpotsBar = ({ joined, capacity }) => (
  <div
    className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--photo-bg)]"
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={capacity}
    aria-valuenow={joined}
    aria-label="Spots filled"
  >
    <div
      className="h-full rounded-full bg-[var(--button-color-bg)] transition-[width]"
      style={{ width: `${Math.min(100, (joined / capacity) * 100)}%` }}
    />
  </div>
);

export default SpotsBar;
