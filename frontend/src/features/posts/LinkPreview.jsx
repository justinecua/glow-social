import { useState } from "react";
import { useGetLinkPreviewQuery } from "@/redux/services/posts/posts";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i;

const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** URLs found in a caption, in order, without duplicates. */
export const findUrls = (text = "") => Array.from(new Set(text.match(URL_RE) ?? []));

/** Renders text with any URLs turned into links. */
export const Linkified = ({ text }) => {
  const parts = text.split(new RegExp(`(${URL_RE.source})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-[var(--button-color-bg)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
};

/** YouTube video id from watch, youtu.be, shorts or embed links. */
const youTubeId = (url) => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    let id = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com") {
      id =
        u.searchParams.get("v") ?? u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/)?.[2] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
};

/** Thumbnail that turns into an inline player when tapped. */
const YouTubeCard = ({ id, title }) => {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border bg-[var(--photo-bg)]">
      <div className="relative aspect-video w-full bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={title || "YouTube video"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            aria-label={`Play ${title || "video"}`}
            onClick={(e) => {
              e.stopPropagation();
              setPlaying(true);
            }}
            className="group absolute inset-0 cursor-pointer"
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute left-1/2 top-1/2 flex h-12 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-black/70 transition group-hover:bg-[#ff0033]">
              <span className="ml-1 border-y-[9px] border-l-[15px] border-y-transparent border-l-white" />
            </span>
          </button>
        )}
      </div>
      {title && (
        <div className="p-3">
          <p className="text-xs text-[var(--color-subtitle)]">YouTube</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold">{title}</p>
        </div>
      )}
    </div>
  );
};

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Card with title, description and image for a link in a post. */
const LinkPreview = ({ url }) => {
  const { data, isLoading } = useGetLinkPreviewQuery(url);
  const [imgOk, setImgOk] = useState(true);

  const ytId = youTubeId(url);
  if (ytId) return <YouTubeCard id={ytId} title={data?.title} />;

  const directImage = IMAGE_EXT.test(url);

  // The link points straight at an image: show the picture itself.
  if ((directImage || data?.kind === "image") && imgOk) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-3 block overflow-hidden rounded-xl bg-[var(--photo-bg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={data?.image || url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgOk(false)}
          className="max-h-[28rem] w-full object-cover"
        />
      </a>
    );
  }

  if (isLoading) {
    return <div className="mt-3 h-20 animate-pulse rounded-xl bg-[var(--photo-bg)]" />;
  }

  // No metadata (site blocks previews, or has none): a simple site card.
  if (!data?.title) {
    const host = hostOf(url);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-3 flex items-center gap-3 rounded-xl border bg-[var(--photo-bg)] p-3 hover:opacity-90"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={`https://${host}/favicon.ico`}
          alt=""
          referrerPolicy="no-referrer"
          className="h-5 w-5 shrink-0"
          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{host}</p>
          <p className="truncate text-xs text-[var(--color-subtitle)]">Open link ↗</p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-3 flex overflow-hidden rounded-xl border bg-[var(--photo-bg)] hover:opacity-90"
      onClick={(e) => e.stopPropagation()}
    >
      {data.image && imgOk && (
        // Image fills a fixed-width column; the text sets the card height,
        // so tall images get cropped instead of stretching the card.
        <div className="relative w-24 shrink-0 sm:w-32">
          <img
            src={data.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}
      <div className="min-h-24 min-w-0 flex-1 p-3">
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-subtitle)]">
          {data.favicon && (
            <img
              src={data.favicon}
              alt=""
              referrerPolicy="no-referrer"
              className="h-3.5 w-3.5"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <span className="truncate">{data.site_name || hostOf(url)}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-semibold">{data.title}</p>
        {data.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-subtitle)]">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
};

export default LinkPreview;
