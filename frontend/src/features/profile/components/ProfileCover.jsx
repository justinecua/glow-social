import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NoProfile from "@/assets/images/No-Profile.jpg";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { useSparkRing } from "@/features/sparks/SparkRing";
import { openSparks } from "@/redux/services/sparks";
import { accountPhoto } from "@/features/posts/botAccounts";
import { presetCover } from "../design/designStyle";

// Shown when there's no cover photo: a soft brand glow instead of a flat grey box.
const EMPTY_COVER =
  "radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--button-color-bg) 45%, transparent) 0%, transparent 55%)," +
  "radial-gradient(120% 140% at 100% 100%, color-mix(in srgb, #ff5fa2 30%, transparent) 0%, transparent 55%)," +
  "var(--photo-bg)";

const ACCENT_COVER =
  "linear-gradient(135deg, color-mix(in srgb, var(--button-color-bg) 75%, transparent), color-mix(in srgb, var(--button-color-bg) 18%, transparent))";

const HEIGHTS = {
  compact: "h-28 sm:h-36 md:h-44",
  normal: "h-44 sm:h-56 md:h-72",
  tall: "h-56 sm:h-72 md:h-96",
};

const ProfileCover = ({ item, design, look }) => {
  const [imgError, setImgError] = useState(false);
  const [coverError, setCoverError] = useState(false);

  // Glowing ring when they have sparks today (fades as it ages).
  const ring = useSparkRing(item?.id);
  const ringColor = ring?.close ? "245,165,36" : "120,110,255";
  const ringStyle = ring
    ? {
        boxShadow: ring.unseen
          ? `0 0 0 3px rgba(${ringColor},${0.4 + 0.6 * ring.brightness}), 0 0 ${8 + 22 * ring.brightness}px rgba(${ringColor},${0.3 + 0.4 * ring.brightness})`
          : "0 0 0 3px rgba(127,127,127,0.45)",
        cursor: "pointer",
      }
    : undefined;

  const noCover = design.header_layout === "no_cover";
  const centered = noCover || design.header_layout === "centered";
  const preset = presetCover(design);
  const showPhoto = !noCover && !preset && item?.cover_photo && !coverError;
  const coverBg = noCover ? ACCENT_COVER : preset ?? look.themeCover ?? EMPTY_COVER;
  const photo = accountPhoto(item);
  const shape = design.avatar_shape === "rounded" ? "rounded-[28%]" : "rounded-full";
  const frame = !ring && design.avatar_frame !== "none" ? `pf-frame-${design.avatar_frame}` : "";

  return (
    <div className="relative">
      {/* Cover */}
      <div
        className={`relative w-full overflow-hidden rounded-[var(--pf-radius)] ${HEIGHTS[noCover ? "compact" : design.cover_height]} ${
          design.cover_animation === "drift" && !showPhoto ? "pf-cover-drift" : ""
        } ${design.cover_animation === "pan" && showPhoto ? "pf-cover-pan" : ""}`}
        style={showPhoto ? undefined : { background: coverBg }}
      >
        {showPhoto && (
          <img
            src={item.cover_photo}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setCoverError(true)}
          />
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <Link
            to="/"
            aria-label="Back to home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="[&_button]:mr-0 [&_button]:rounded-full [&_button]:border-0 [&_button]:bg-black/35 [&_button]:text-white [&_button]:backdrop-blur-sm [&_button:hover]:bg-black/55">
            <ModeToggle />
          </div>
        </div>
      </div>

      {/* Avatar, overlapping the cover; the frame wraps it */}
      <div
        className={`absolute -bottom-14 h-28 w-28 sm:-bottom-[4.5rem] sm:h-36 sm:w-36 md:-bottom-20 md:h-40 md:w-40 ${shape} ${frame} ${
          centered ? "left-1/2 -translate-x-1/2" : "left-4 sm:left-6"
        }`}
      >
        <div
          className={`h-full w-full overflow-hidden border-4 border-[var(--home-card)] bg-[var(--photo-bg)] ${shape}`}
          style={ringStyle}
          role={ring ? "button" : undefined}
          aria-label={ring ? "View sparks" : undefined}
          onClick={ring ? () => openSparks({ authorId: Number(item.id) }) : undefined}
        >
          <img
            src={imgError || !photo ? NoProfile : photo}
            alt={item?.username ?? ""}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileCover;
