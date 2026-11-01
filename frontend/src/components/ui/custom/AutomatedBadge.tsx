/** Marks posts and profiles from automated accounts (e.g. @glow_trends). */
const AutomatedBadge = ({ className = "" }: { className?: string }) => (
  <span
    title="This account posts automatically"
    className={`inline-flex items-center rounded border px-1.5 py-px text-[0.65rem] font-medium leading-4 text-[var(--color-subtitle)] ${className}`}
  >
    Automated
  </span>
);

export default AutomatedBadge;
