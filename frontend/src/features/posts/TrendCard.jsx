import { ArrowUpRight, Newspaper } from "lucide-react";
import { useState } from "react";

/** Parsed "Trending in X: Topic" post from @glow_trends, or null. */
export function parseTrend(caption) {
  if (!caption) return null;
  const lines = caption.split("\n").map((l) => l.trim());
  const m = lines[0]?.match(/^Trending in (.+?): (.+)$/);
  if (!m) return null;
  const searches = lines[1]?.match(/^([\d,.]+[KM]?\+?) searches/i)?.[1] ?? "";
  const url = lines.find((l) => /^https?:\/\//.test(l)) ?? "";
  const headlineLine = lines.find((l, i) => i > 1 && l && l !== url && !l.startsWith("#")) ?? "";
  const src = headlineLine.match(/^(.*) \(([^()]+)\)$/);
  let host = "";
  try {
    host = url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    /* bad url */
  }
  return {
    where: m[1].replace(/^the /, ""),
    topic: m[2],
    searches,
    headline: src ? src[1] : headlineLine,
    source: src ? src[2] : host,
    url,
    host,
  };
}

const TrendCard = ({ trend, image }) => {
  const [imgOk, setImgOk] = useState(true);
  const showImage = !!image && imgOk;
  return (
    <div className="mt-1">
      <h3 className="mt-1.5 text-lg font-bold leading-snug text-[var(--title-color)]">
        {trend.topic}
      </h3>
      {trend.url && (
        <a
          href={trend.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="group mt-3 flex items-stretch gap-3 overflow-hidden rounded-xl border p-2.5 transition-colors hover:bg-[var(--button-hover-bg-color)]"
        >
          {/* Google's thumbnails are small: show them at a size that stays sharp. */}
          {showImage ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              onError={() => setImgOk(false)}
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-[var(--color-subtitle)]">
              <Newspaper className="h-5 w-5" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="flex items-center gap-1.5 text-xs text-[var(--color-subtitle)]">
              {trend.source}
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{trend.headline}</p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 self-start text-[var(--color-subtitle)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      )}
    </div>
  );
};

export default TrendCard;
