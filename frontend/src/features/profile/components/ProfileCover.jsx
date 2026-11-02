import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NoProfile from "@/assets/images/No-Profile.jpg";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { useSparkRing } from "@/features/sparks/SparkRing";
import { openSparks } from "@/redux/services/sparks";
import { accountPhoto } from "@/features/posts/botAccounts";

// Shown when there's no cover photo: a soft brand glow instead of a flat grey box.
const EMPTY_COVER =
  "radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--button-color-bg) 45%, transparent) 0%, transparent 55%)," +
  "radial-gradient(120% 140% at 100% 100%, color-mix(in srgb, #ff5fa2 30%, transparent) 0%, transparent 55%)," +
  "var(--photo-bg)";

const ProfileCover = ({ item }) => {
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

  const hasCover = item?.cover_photo && !coverError;
  const photo = accountPhoto(item);

  return (
    <div className="relative">
      {/* Cover */}
      <div
        className="relative h-44 w-full overflow-hidden rounded-xl sm:h-56 md:h-72"
        style={hasCover ? undefined : { background: EMPTY_COVER }}
      >
        {hasCover && (
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

      {/* Avatar, overlapping the cover */}
      <div
        className="absolute -bottom-14 left-4 h-28 w-28 overflow-hidden rounded-full border-4 border-[var(--home-card)] bg-[var(--photo-bg)] sm:-bottom-[4.5rem] sm:left-6 sm:h-36 sm:w-36 md:-bottom-20 md:h-40 md:w-40"
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
  );
};

export default ProfileCover;
