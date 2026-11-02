import { ExternalLink } from "lucide-react";
import { courtLinkLabel } from "./gameUtils";

export const CourtLinkButton = ({ url, className = "" }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer nofollow"
    className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-[var(--photo-bg)] ${className}`}
  >
    <ExternalLink className="h-3.5 w-3.5" /> {courtLinkLabel(url)}
  </a>
);

const CourtBanner = ({ url, preview }) => {
  if (preview.loading) return <div className="aspect-[2.4/1] w-full animate-pulse bg-[var(--photo-bg)]" />;
  if (!preview.image) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group relative block aspect-[2.4/1] w-full overflow-hidden bg-[var(--photo-bg)]"
    >
      <img
        src={preview.image}
        alt={preview.title || "Court"}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={preview.onError}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-3 bottom-3 flex items-end gap-3 text-white">
        {preview.title && <p className="line-clamp-1 min-w-0 text-sm font-semibold drop-shadow">{preview.title}</p>}
        <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
          {courtLinkLabel(url)} <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </a>
  );
};

export default CourtBanner;
