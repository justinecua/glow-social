import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Plus, Star } from "lucide-react";
import {
  SPARK_BACKGROUNDS,
  openSparkComposer,
  openSparks,
  useGetSparksQuery,
} from "@/redux/services/sparks";
import { useStoredUser } from "@/utils/auth";
import { Avatar } from "@/features/discover/components/PersonRow";

const DAY_MS = 24 * 60 * 60 * 1000;
// Glow blue (--button-color-bg #2442de), the app accent.
const EMBER = "36,66,222";
const EMBER_CLOSE = "245,165,36";

/** The photo (or coloured text card) of a spark, filling its box. */
export const SparkPrint = ({ s, className = "", textClass = "text-[9px]" }) =>
  s.photo ? (
    <img
      src={s.photo}
      alt=""
      loading="lazy"
      draggable={false}
      className={`h-full w-full object-cover ${className}`}
    />
  ) : (
    <span
      className={`flex h-full w-full items-center justify-center p-1.5 text-center font-bold leading-tight text-white ${textClass} ${className}`}
      style={{
        background:
          SPARK_BACKGROUNDS[s.background] || SPARK_BACKGROUNDS.sunrise,
      }}
    >
      <span className="line-clamp-4">{s.text}</span>
    </span>
  );

/** How much of a spark's 24 hours is left: 1 = just lit, 0 = gone. */
const lifeLeft = (s, now) => {
  const end = s.expires_at
    ? new Date(s.expires_at).getTime()
    : new Date(s.created_at).getTime() + DAY_MS;
  return Math.min(1, Math.max(0, (end - now) / DAY_MS));
};

const SIZE = 68; // ring box
const R = 31.5;
const C = 2 * Math.PI * R;

/** One person: their latest spark in a ring that burns down over 24 hours.
 *  Newer sparks are brighter; older ones dim toward embers. Unseen ones
 *  glow, and your own glows stronger the more it's sparked. */
const Ember = ({ g, now }) => {
  const top = g.latest;
  const unseen = g.sparks.filter((x) => !x.seen).length;
  const close = g.sparks.some((x) => x.close_friends_only);
  const lit = unseen > 0;
  const rgb = close ? EMBER_CLOSE : EMBER;
  const life = lifeLeft(top, now);
  // Spark counts only come back for your own sparks.
  const warms = g.sparks.reduce((n, x) => n + (x.warms ?? 0), 0);
  const heat = lit || top.mine ? Math.min(1, 0.45 + warms * 0.08) : 0;
  // Just posted (by you): play the ignite flare once.
  const justLit = top.mine && now - new Date(top.created_at).getTime() < 20_000;

  // Tip of the burning ring (starts at 12 o'clock, runs clockwise).
  const angle = -Math.PI / 2 + life * 2 * Math.PI;
  const tip = {
    x: SIZE / 2 + R * Math.cos(angle),
    y: SIZE / 2 + R * Math.sin(angle),
  };

  return (
    <button
      type="button"
      onClick={() => openSparks({ authorId: top.author.id })}
      aria-label={`${top.mine ? "Your" : `${top.author.username}'s`} ${
        g.sparks.length > 1 ? `${g.sparks.length} sparks` : "spark"
      }, latest at ${new Date(top.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${lit ? `, ${unseen} new` : ""}`}
      className="group flex w-[72px] shrink-0 cursor-pointer flex-col items-center gap-1 outline-none"
    >
      <span
        className={`relative block transition-transform duration-300 ease-out group-hover:scale-105 group-active:scale-95 ${
          justLit ? "animate-[spark-ignite_1.1s_ease-out_both]" : ""
        }`}
        style={{ width: SIZE, height: SIZE }}
      >
        {/* glow behind: stronger when unseen / sparked */}
        {heat > 0 && (
          <span
            className="absolute inset-1 rounded-full"
            style={{
              boxShadow: `0 0 ${10 + heat * 16}px ${heat * 4}px rgba(${rgb},${0.25 + heat * 0.35})`,
            }}
            aria-hidden
          />
        )}

        {/* the spark itself, dimmer as it ages */}
        <span
          className="absolute inset-[6px] overflow-hidden rounded-full bg-[var(--photo-bg)] transition-[filter] duration-700"
          style={{
            filter: `saturate(${0.25 + 0.75 * life}) brightness(${0.55 + 0.45 * life})${
              lit ? "" : " grayscale(0.2)"
            }`,
          }}
        >
          <SparkPrint s={top} textClass="text-[8px]" />
        </span>

        {/* fuse ring: what's left of its 24 hours */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="pointer-events-none absolute inset-0 overflow-visible"
          aria-hidden
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="color-mix(in srgb, var(--color-subtitle) 22%, transparent)"
            strokeWidth="2"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={
              lit
                ? `rgb(${rgb})`
                : "color-mix(in srgb, var(--color-subtitle) 70%, transparent)"
            }
            strokeWidth={lit ? 2.75 : 2}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - life)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className="transition-[stroke-dashoffset] duration-700"
          />
          {lit && life > 0.01 && (
            <circle
              cx={tip.x}
              cy={tip.y}
              r="3"
              fill="#ffffff"
              style={{
                filter: `drop-shadow(0 0 3px rgb(${rgb})) drop-shadow(0 0 6px rgba(${rgb},0.7))`,
              }}
              className="animate-[spark-flicker_1.6s_ease-in-out_infinite]"
            />
          )}
        </svg>

        <span className="absolute bottom-0 right-0 block rounded-full ring-2 ring-[var(--home-card)]">
          <Avatar
            src={top.author.profile_photo}
            alt={top.author.username}
            className="h-5 w-5"
          />
        </span>
        {close && (
          <Star
            className="absolute left-0 top-0 h-3.5 w-3.5 text-[#f5a524]"
            fill="currentColor"
          />
        )}
        {g.sparks.length > 1 && (
          <span
            className="absolute -right-0.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ring-2 ring-[var(--home-card)]"
            style={{
              background: lit ? `rgb(${rgb})` : "var(--color-subtitle)",
            }}
          >
            {g.sparks.length}
          </span>
        )}
      </span>

      <span
        className={`max-w-full truncate text-[11px] leading-tight ${
          lit ? "font-semibold" : "text-[var(--color-subtitle)]"
        }`}
      >
        {top.mine ? "You" : top.author.username}
      </span>
    </button>
  );
};

/** Today's sparks. Each person's ring burns down over 24 hours, so the
 *  strip shows whose spark is fresh and whose is about to go out. */
const SparksTimeline = () => {
  const user = useStoredUser();
  const me = user?.user;
  const { data } = useGetSparksQuery(undefined, { skip: !user });
  const sparks = useMemo(() => data?.sparks ?? [], [data]);
  const unseen = useMemo(() => sparks.filter((s) => !s.seen), [sparks]);
  const scroller = useRef(null);

  // Tick every 30s so rings burn down and labels age while you watch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => setNow(Date.now()), [sparks]);

  // Freshest first: what's burning brightest leads the strip.
  const groups = useMemo(() => {
    const byAuthor = new Map();
    for (const s of sparks) {
      const g = byAuthor.get(s.author.id) ?? { sparks: [] };
      g.sparks.push(s);
      byAuthor.set(s.author.id, g);
    }
    const time = (x) => new Date(x.created_at).getTime();
    return [...byAuthor.values()]
      .map((g) => {
        g.sparks.sort((a, b) => time(a) - time(b));
        return { ...g, latest: g.sparks[g.sparks.length - 1] };
      })
      .sort((a, b) => {
        // unseen before seen, then newest first
        const ua = a.sparks.some((x) => !x.seen) ? 0 : 1;
        const ub = b.sparks.some((x) => !x.seen) ? 0 : 1;
        return ua - ub || time(b.latest) - time(a.latest);
      });
  }, [sparks]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = 0;
  }, [groups.length]);

  if (!user) return null;

  return (
    <section
      className="mb-3 rounded-xl border bg-[var(--home-card)] pb-3 pt-3"
      aria-label="Sparks today"
    >
      <div className="mb-2.5 flex items-center gap-2 px-4">
        <h2 className="text-sm font-semibold">Sparks</h2>
        {unseen.length > 0 && (
          <span className="rounded-full bg-[rgba(36,66,222,0.15)] px-2 py-0.5 text-[11px] font-medium text-[var(--button-color-bg)] dark:text-[#a9b8ff]">
            {unseen.length} new
          </span>
        )}
        {sparks.length > 0 && (
          <button
            type="button"
            onClick={() => openSparks({ sparkId: (unseen[0] ?? sparks[0]).id })}
            className="ml-auto flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--button-color-bg)] transition-colors hover:bg-[var(--button-hover-bg-color)] dark:text-[#a9b8ff]"
          >
            <Play className="h-3 w-3" fill="currentColor" />
            {unseen.length ? "New sparks" : "All sparks"}
          </button>
        )}
      </div>

      <div
        ref={scroller}
        className="no-scrollbar flex items-start gap-2 overflow-x-auto px-3 pb-1 pt-1"
      >
        {/* Yours: an unlit wick */}
        <button
          type="button"
          onClick={openSparkComposer}
          aria-label="Light a spark"
          className="group flex w-[72px] shrink-0 cursor-pointer flex-col items-center gap-1"
        >
          <span
            className="relative block"
            style={{ width: SIZE, height: SIZE }}
          >
            <span className="absolute inset-[6px] overflow-hidden rounded-full opacity-80 transition-opacity group-hover:opacity-100">
              <Avatar
                src={me?.profile_photo}
                alt=""
                className="h-full w-full"
              />
            </span>
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="absolute inset-0"
              aria-hidden
            >
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke="color-mix(in srgb, var(--color-subtitle) 45%, transparent)"
                strokeWidth="1.5"
                strokeDasharray="2 5"
                strokeLinecap="round"
                className="origin-center transition-transform duration-700 group-hover:rotate-90"
              />
            </svg>
            <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--button-color-bg)] text-white ring-2 ring-[var(--home-card)] transition-transform group-hover:scale-110">
              <Plus className="h-3 w-3" strokeWidth={3} />
            </span>
          </span>
          <span className="text-[11px] leading-tight text-[var(--color-subtitle)]">
            Light one
          </span>
        </button>

        {groups.length === 0 ? (
          <p className="self-center pb-5 text-sm leading-snug text-[var(--color-subtitle)]">
            Nothing's lit yet today.
            <br />
            Share a moment. It burns for 24 hours.
          </p>
        ) : (
          groups.map((g) => <Ember key={g.latest.author.id} g={g} now={now} />)
        )}
        <span className="w-1 shrink-0" aria-hidden />
      </div>
    </section>
  );
};

export default SparksTimeline;
