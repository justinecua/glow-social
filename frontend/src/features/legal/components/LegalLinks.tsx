import { Link } from "react-router-dom";

const LINKS = [
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/guidelines", label: "Guidelines" },
];

type LegalLinksProps = {
  className?: string;
  /** "inline": one compact row (auth pages, settings).
   *  "footer": sidebar footer with a divider and the © on its own line. */
  variant?: "inline" | "footer";
};

const LegalLinks = ({ className = "", variant = "inline" }: LegalLinksProps) => {
  const year = new Date().getFullYear();

  if (variant === "footer") {
    return (
      <footer className={`min-w-0 text-[11px] text-[var(--color-subtitle)] ${className}`}>
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-1.5">
          {LINKS.map(({ to, label }) => (
            <span key={to} className="flex items-center gap-1.5">
              <Link to={to} className="hover:text-[var(--title-color)] hover:underline">
                {label}
              </Link>
              <span aria-hidden className="opacity-50">·</span>
            </span>
          ))}
          <span className="opacity-70">© {year} Glow</span>
        </nav>
      </footer>
    );
  }

  return (
    <nav
      aria-label="Legal"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-subtitle)] ${className}`}
    >
      {LINKS.map(({ to, label }, i) => (
        <span key={to} className="flex items-center gap-3">
          {i > 0 && <span aria-hidden>·</span>}
          <Link to={to} className="hover:text-[var(--title-color)] hover:underline">
            {label}
          </Link>
        </span>
      ))}
      <span aria-hidden>·</span>
      <span>© {year} Glow</span>
    </nav>
  );
};

export default LegalLinks;
