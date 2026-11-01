import { useState } from "react";
import { ImageOff } from "lucide-react";

type Props = React.ImgHTMLAttributes<HTMLImageElement>;

/** A post photo that shows a calm placeholder instead of the browser's
 *  broken-image icon when the file is missing or can't load. */
const PostImage = ({ className = "", alt, ...props }: Props) => {
  const [failed, setFailed] = useState(false);

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

  return <img {...props} alt={alt} className={className} onError={() => setFailed(true)} />;
};

export default PostImage;
