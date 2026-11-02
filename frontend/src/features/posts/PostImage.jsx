import { useCallback, useState } from "react";
import { ImageOff } from "lucide-react";

/** A post photo that fades in once loaded, and shows a calm placeholder
 *  instead of the browser's broken-image icon when the file can't load. */
const PostImage = ({ className = "", alt, ...props }) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Cached images can finish loading before React attaches onLoad, so
  // check `complete` when the element mounts too.
  const checkCached = useCallback((img) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  if (failed || !props.src) {
    return (
      <div
        role="img"
        aria-label="Photo unavailable"
        className={`flex h-full min-h-48 w-full flex-col items-center justify-center gap-2 rounded-lg bg-[var(--photo-bg)] text-[var(--color-subtitle)] ${className
          .split(" ")
          .filter((c) => c.startsWith("rounded"))
          .join(" ")}`}
      >
        <ImageOff className="h-8 w-8 opacity-60" strokeWidth={1.5} />
        <span className="text-xs">Photo unavailable</span>
      </div>
    );
  }

  return (
    <img
      {...props}
      ref={checkCached}
      alt={alt}
      className={`${className} transition-opacity duration-300 ease-out ${loaded ? "opacity-100" : "opacity-0"}`}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  );
};

export default PostImage;
