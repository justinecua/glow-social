const GlowLogo = ({ className = "h-10 w-10", title = "Glow", variant = "tile", animated = false }) => {
  const a11y = {
    role: title ? "img" : undefined,
    "aria-label": title || undefined,
    "aria-hidden": title ? undefined : true, // decorative when the surrounding link already names Glow
  };

  if (variant === "mark") {
    return (
      <svg viewBox="18 18 84 84" className={`${animated ? "glow-rise " : ""}${className}`} {...a11y}>
        <path className="glow-rise-outer" d="M60 20 L100 60 L60 100 L20 60 Z" fill="var(--mark-outer)" style={{ fillOpacity: "var(--mark-outer-opacity)" }} />
        <path className="glow-rise-mid" d="M60 44 L88 72 L60 100 L32 72 Z" fill="var(--mark-layer)" style={{ fillOpacity: "var(--mark-layer-opacity)" }} />
        <path className="glow-rise-core" d="M60 68 L76 84 L60 100 L44 84 Z" fill="var(--mark-core)" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 120" className={className} {...a11y}>
      <rect width="120" height="120" rx="28" fill="#2442de" />
      <path d="M60 20 L100 60 L60 100 L20 60 Z" fill="#a9b8ff" fillOpacity="0.22" />
      <path d="M60 44 L88 72 L60 100 L32 72 Z" fill="#a9b8ff" fillOpacity="0.5" />
      <path d="M60 68 L76 84 L60 100 L44 84 Z" fill="#ffffff" />
    </svg>
  );
};

export default GlowLogo;
