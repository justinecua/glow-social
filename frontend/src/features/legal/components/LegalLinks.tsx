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
      <footer
        className={`border-t border-[var(--border)] pt-4 text-[11px] text-[var(--color-subtitle)] ${className}`}
      >
        <nav aria-label="Legal" className="flex flex-wrap items-center gap-1">
          {LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="rounded-md px-2 py-1 transition-colors hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]"
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="mt-2 px-2 opacity-70">© {year} Glow. All rights reserved.</p>
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
