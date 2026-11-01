import { useEffect, useMemo, useRef } from "react";
import { Play, Plus, Star } from "lucide-react";
import {
  SPARK_BACKGROUNDS,
  openSparkComposer,
  openSparks,
  useGetSparksQuery,
  type Spark,
} from "@/redux/services/sparks";
import { useStoredUser } from "@/utils/auth";
import { Avatar } from "@/features/discover/components/PersonRow";

const TILE_W = 72;
const MIN_GAP = 8;
const MAX_GAP = 56;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();

/** Gap between two sparks grows with the time between them, but is capped,
 *  so quiet hours don't leave an empty strip. */
const gapFor = (a: string, b: string) => {
  const minutes = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return Math.round(Math.min(MAX_GAP, Math.max(MIN_GAP, minutes / 6)));
};

const Tile = ({ s }: { s: Spark }) => {
  const glow = s.seen
    ? "ring-1 ring-[color-mix(in_srgb,var(--color-subtitle)_35%,transparent)] opacity-70"
    : s.close_friends_only
      ? "ring-2 ring-[#f5a524] shadow-[0_0_14px_rgba(245,165,36,0.45)]"
      : "ring-2 ring-[#7b6dff] shadow-[0_0_14px_rgba(123,109,255,0.45)]";
  return (
    <button
      type="button"
      onClick={() => openSparks({ sparkId: s.id })}
      aria-label={`${s.mine ? "Your" : `${s.author.username}'s`} spark at ${timeOf(s.created_at)}`}
      className="group flex shrink-0 cursor-pointer flex-col items-center gap-1.5"
      style={{ width: TILE_W }}
    >
      <span
        className={`relative block h-24 w-full overflow-hidden rounded-xl transition-transform group-hover:-translate-y-0.5 ${glow}`}
        style={!s.photo ? { background: SPARK_BACKGROUNDS[s.background] || SPARK_BACKGROUNDS.sunrise } : undefined}
      >
        {s.photo ? (
          <img src={s.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center p-1.5 text-center text-[10px] font-bold leading-tight text-white line-clamp-4">
            {s.text}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute bottom-1 left-1 block overflow-hidden rounded-full ring-2 ring-white/90">
          <Avatar src={s.author.profile_photo} alt={s.author.username} className="h-6 w-6" />
        </span>
        {s.close_friends_only && (
          <Star className="absolute right-1 top-1 h-3 w-3 text-[#ffd66b] drop-shadow" fill="currentColor" />
        )}
      </span>
      <span className={`text-[10px] tabular-nums ${s.seen ? "text-[var(--color-subtitle)]" : "font-semibold"}`}>
        {timeOf(s.created_at)}
      </span>
    </button>
  );
};

/** Today's sparks in time order: everyone's day, not person by person. */
const SparksTimeline = () => {
  const user = useStoredUser();
  const me = user?.user;
  const { data } = useGetSparksQuery(undefined, { skip: !user });
  const scroller = useRef<HTMLDivElement>(null);
  const sparks: Spark[] = data?.sparks ?? [];
  const unseen = useMemo(() => sparks.filter((s) => !s.seen), [sparks]);

  // Start scrolled to the latest (right end).
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [sparks.length]);

  if (!user) return null;

  return (
    <section className="mb-3 rounded-xl border bg-[var(--home-card)] pb-3 pt-3" aria-label="Sparks today">
      <div className="mb-2.5 flex items-center px-4">
        <h2 className="text-sm font-semibold">Today</h2>
        {unseen.length > 0 && (
          <span className="ml-2 rounded-full bg-[color-mix(in_srgb,#7b6dff_18%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[#7b6dff] dark:text-[#a99fff]">
            {unseen.length} new
          </span>
        )}
        {sparks.length > 0 && (
          <button
            type="button"
            onClick={() => openSparks({ sparkId: (unseen[0] ?? sparks[0]).id })}
            className="ml-auto flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--button-color-bg)] hover:bg-[var(--button-hover-bg-color)] dark:text-[#a99fff]"
          >
            <Play className="h-3 w-3" fill="currentColor" />
            Play {unseen.length ? "new" : "all"}
          </button>
        )}
      </div>

      <div ref={scroller} className="no-scrollbar flex items-start overflow-x-auto px-4">
        {/* Your spark */}
        <button
          type="button"
          onClick={openSparkComposer}
          aria-label="Post a spark"
          className="group flex shrink-0 cursor-pointer flex-col items-center gap-1.5"
          style={{ width: TILE_W }}
        >
          <span className="relative flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[color-mix(in_srgb,var(--color-subtitle)_40%,transparent)] transition-colors group-hover:border-[var(--button-color-bg)] group-hover:bg-[var(--button-hover-bg-color)]">
            <span className="relative">
              <Avatar src={me?.profile_photo} alt={me?.username ?? ""} className="h-9 w-9" />
              <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--button-color-bg)] text-white ring-2 ring-[var(--home-card)]">
                <Plus className="h-3 w-3" strokeWidth={3} />
              </span>
            </span>
          </span>
          <span className="text-[10px] text-[var(--color-subtitle)]">Your spark</span>
        </button>

        {sparks.length === 0 ? (
          <p className="ml-4 self-center pb-5 text-sm leading-snug text-[var(--color-subtitle)]">
            No sparks yet today.
            <br />
            Share a moment. It fades in 24 hours.
          </p>
        ) : (
          <>
            <span className="mt-12 h-px w-4 shrink-0 bg-[color-mix(in_srgb,var(--color-subtitle)_30%,transparent)]" aria-hidden />
            {sparks.map((s, idx) => (
              <div key={s.id} className="flex shrink-0 items-start">
                {idx > 0 && (
                  // Connector: longer when more time passed between sparks.
                  <span
                    aria-hidden
                    className="mt-12 h-px shrink-0 bg-[color-mix(in_srgb,var(--color-subtitle)_30%,transparent)]"
                    style={{ width: gapFor(sparks[idx - 1].created_at, s.created_at) }}
                  />
                )}
                <Tile s={s} />
              </div>
            ))}
            <span className="ml-2 mt-[42px] flex shrink-0 items-center gap-1.5 pr-1 text-[10px] font-semibold text-[#7b6dff] dark:text-[#a99fff]" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
              now
            </span>
          </>
        )}
      </div>
    </section>
  );
};

export default SparksTimeline;
