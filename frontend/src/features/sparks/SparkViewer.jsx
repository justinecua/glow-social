import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// eslint-disable-next-line no-unused-vars -- used as <motion.*> in JSX
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  ImageOff,
  Star,
  Flame,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteSparkMutation,
  useGetSparkStatsQuery,
  useViewSparkMutation,
  useUnwarmSparkMutation,
  useWarmSparkMutation,
} from "@/redux/services/sparks";
import { Avatar } from "@/features/discover/components/PersonRow";
import SendGlowDialog from "@/features/glows/SendGlowDialog";
import { SparkPrint } from "./SparksTimeline";
import { useKudosSent } from "@/features/glows/useKudosSent";

const DURATION_MS = 5000;
const HOLD_MS = 450;
const SWIPE_PX = 80;
const CARD_MOTION = {
  enter: ({ dir, slide }) => ({ opacity: 0, x: slide ? (dir >= 0 ? 60 : -60) : 0 }),
  center: { opacity: 1, x: 0 },
  exit: ({ dir, slide }) => ({ opacity: 0, x: slide ? (dir >= 0 ? -60 : 60) : 0, transition: { duration: 0.2 } }),
};
const SWIPE_SPEED = 500;
// Glow blue (--button-color-bg #2442de), the app accent.
const EMBER = "36,66,222";
const EMBER_CLOSE = "245,165,36";

const timeOf = (iso) =>
  new Date(iso)
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .replace(" ", "")
    .toLowerCase();
const nameOf = (a) =>
  [a.firstname, a.lastname].filter(Boolean).join(" ") || a.username;

/** Who viewed / sparked your spark. */
const StatsPanel = ({ id, onClose }) => {
  const { data, isLoading } = useGetSparkStatsQuery(id);
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 max-h-[60%] overflow-y-auto rounded-t-2xl bg-[var(--home-card)] p-4 text-[var(--title-color)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex items-center">
        <p className="text-sm font-semibold">
          {data
            ? `${data.views} ${data.views === 1 ? "view" : "views"} · ${data.warms} sparked`
            : "Viewers"}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto cursor-pointer rounded-full p-1 hover:bg-[var(--button-hover-bg-color)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {isLoading && (
        <p className="text-sm text-[var(--color-subtitle)]">Loading…</p>
      )}
      {data && data.viewers.length === 0 && (
        <p className="text-sm text-[var(--color-subtitle)]">
          No one has seen it yet.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {data?.viewers.map((v) => (
          <li key={v.id} className="flex items-center gap-3">
            <Avatar
              src={v.profile_photo}
              alt={v.username}
              className="h-8 w-8"
            />
            <span className="flex-1 truncate text-sm">
              {[v.firstname, v.lastname].filter(Boolean).join(" ") ||
                v.username}
            </span>
            {v.warmed && (
              <Flame
                className="h-4 w-4 text-[var(--button-color-bg)]"
                fill="currentColor"
                aria-label="Sparked"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Person by person, matching the Sparks strip: people ordered by their
 *  latest spark, each person's sparks oldest first. */
const byPerson = (sparks) => {
  const time = (x) => new Date(x.created_at).getTime();
  const groups = new Map();
  for (const sp of sparks) {
    if (!groups.has(sp.author.id)) groups.set(sp.author.id, []);
    groups.get(sp.author.id).push(sp);
  }
  return [...groups.values()]
    .map((g) => g.sort((a, b) => time(a) - time(b)))
    .sort((a, b) => time(a[a.length - 1]) - time(b[b.length - 1]))
    .flat();
};

/** One fuse for all of a person's sparks. The burnt part glows, the tip
 *  is where you are, and small gaps mark where each spark starts. */
const Fuse = ({ count, pos, progress, rgb }) => {
  const done = (pos + progress) / count;
  return (
    <div className="relative h-[3px] w-full" aria-hidden>
      <div className="absolute inset-0 rounded-full bg-white/20" />
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${done * 100}%`, background: `rgb(${rgb})` }}
      />
      {/* burning tip */}
      <div
        className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffffff]"
        style={{
          left: `${done * 100}%`,
          boxShadow: `0 0 6px 2px rgba(${rgb},0.9), 0 0 14px 4px rgba(${rgb},0.45)`,
        }}
      />
      {Array.from({ length: count - 1 }, (_, k) => (
        <div
          key={k}
          className="absolute inset-y-0 w-[3px] bg-black/70"
          style={{ left: `calc(${((k + 1) / count) * 100}% - 1.5px)` }}
        />
      ))}
    </div>
  );
};

/** Full-screen spark viewer. Swipe or tap for the next one; hold to spark it. */
const SparkViewer = ({ sparks, startIndex, onClose }) => {
  // Freeze the list for this session so it doesn't shift while watching.
  const list = useMemo(() => byPerson(sparks), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(() =>
    Math.max(
      0,
      list.findIndex((x) => x.id === sparks[startIndex]?.id),
    ),
  );
  const [dir, setDir] = useState(1);
  const lastAuthor = useRef(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [kudosOpen, setKudosOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  // Load state is keyed by spark id, so a fast (cached) load can't be
  // wiped out by the per-spark reset and leave the photo invisible.
  const [loadedId, setLoadedId] = useState(null);
  const [failedId, setFailedId] = useState(null);
  // Gesture hint: only on someone's first look.
  const [showHint] = useState(() => {
    try {
      if (localStorage.getItem("glow:spark-hint-seen")) return false;
      localStorage.setItem("glow:spark-hint-seen", "1");
    } catch {
      /* storage blocked: show it */
    }
    return true;
  });
  const holdTimer = useRef(null);
  const held = useRef(false);

  const [viewSpark] = useViewSparkMutation();
  const [warmSpark] = useWarmSparkMutation();
  const [unwarmSpark] = useUnwarmSparkMutation();
  const [deleteSpark] = useDeleteSparkMutation();

  const s = list[i];
  const kudosSent = useKudosSent(s && !s.mine ? s.author.id : null);
  const [warmed, setWarmed] = useState({});
  const isWarmed = s ? (warmed[s.id] ?? s.warmed) : false;

  const next = useCallback(() => {
    setDir(1);
    if (i < list.length - 1) setI(i + 1);
    else onClose();
  }, [i, list.length, onClose]);
  const prev = useCallback(() => {
    setDir(-1);
    setI((n) => Math.max(0, n - 1));
  }, []);

  // Reset per spark; mark it seen.
  useEffect(() => {
    setProgress(0);
    setStatsOpen(false);
    const cur = list[i];
    if (cur && !cur.mine && !cur.seen) viewSpark(cur.id);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer (paused while holding, dragging, reading stats, sending kudos or loading).
  const cur = list[i];
  const imgReady = !cur?.photo || loadedId === cur.id || failedId === cur.id;
  const halted = paused || dragging || statsOpen || kudosOpen || !imgReady;
  useEffect(() => {
    if (halted) return;
    const step = 50;
    const t = window.setInterval(() => {
      setProgress((p) => {
        const n = p + step / DURATION_MS;
        if (n >= 1) {
          window.clearInterval(t);
          window.setTimeout(next, 0);
          return 1;
        }
        return n;
      });
    }, step);
    return () => window.clearInterval(t);
  }, [halted, next]);

  useEffect(() => {
    lastAuthor.current = s?.author.id ?? null;
  }, [s?.author.id]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (kudosOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose, kudosOpen]);

  // Lock page scroll while open.
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);

  if (!s) return null;

  const slide = lastAuthor.current !== null && lastAuthor.current !== s.author.id; // slide between people, fade within one person's sparks
  const motionInfo = { dir, slide };

  const doWarm = () => {
    if (s.mine || isWarmed) return;
    setWarmed((w) => ({ ...w, [s.id]: true }));
    setBurst((b) => b + 1);
    warmSpark(s.id);
  };

  // The button toggles: tap again to unspark. (Holding only ever sparks.)
  const toggleSpark = () => {
    if (s.mine) return;
    if (!isWarmed) return doWarm();
    setWarmed((w) => ({ ...w, [s.id]: false }));
    unwarmSpark(s.id)
      .unwrap()
      .catch(() => {
        setWarmed((w) => ({ ...w, [s.id]: true }));
        toast.error("Couldn't unspark. Try again.");
      });
  };

  const clearHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const onPointerDown = () => {
    setPaused(true);
    held.current = false;
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      doWarm();
    }, HOLD_MS);
  };
  const onPointerUp = () => {
    clearHold();
    setPaused(false);
  };
  // A tap (not a hold, not a drag): left third goes back, else forward.
  const onTap = (e) => {
    if (held.current) return;
    const rect = e.target?.closest?.("[data-spark]")?.getBoundingClientRect();
    if (rect && e.clientX - rect.left < rect.width / 3) prev();
    else next();
  };

  const remove = async () => {
    try {
      await deleteSpark(s.id).unwrap();
      toast.success("Spark deleted");
      onClose();
    } catch {
      toast.error("Couldn't delete it. Try again.");
    }
  };

  const run = list.filter((x) => x.author.id === s.author.id);
  const pos = run.findIndex((x) => x.id === s.id);
  const rgb = s.close_friends_only ? EMBER_CLOSE : EMBER;
  const prevS = list[i - 1];
  const nextS = list[i + 1];

  return (
    <div
      className={`fixed inset-0 ${kudosOpen ? "z-40" : "z-[400]"} flex items-center justify-center bg-[#0b0b0c]`}
      role="dialog"
      aria-label="Sparks"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-30 cursor-pointer rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Desktop arrows */}
      {prevS && (
        <button
          type="button"
          onClick={prev}
          aria-label="Previous"
          className="absolute left-6 z-20 hidden cursor-pointer rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:block"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {nextS && (
        <button
          type="button"
          onClick={next}
          aria-label="Next"
          className="absolute right-6 z-20 hidden cursor-pointer rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:block"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div className="relative h-[100dvh] w-full select-none sm:aspect-[9/16] sm:h-[min(92dvh,860px)] sm:w-auto">
        <AnimatePresence initial={false} custom={motionInfo} mode="popLayout">
          <motion.div
            key={s.id}
            custom={motionInfo}
            variants={CARD_MOTION}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute inset-0"
          >
          <motion.div
            data-spark
            drag="x"
            dragSnapToOrigin
            dragElastic={0.5}
            onDragStart={() => {
              clearHold();
              held.current = true; // a drag is never a tap
              setDragging(true);
            }}
            onDragEnd={(_, info) => {
              setDragging(false);
              setPaused(false);
              const { offset, velocity } = info;
              if (offset.x < -SWIPE_PX || velocity.x < -SWIPE_SPEED) next();
              else if (offset.x > SWIPE_PX || velocity.x > SWIPE_SPEED) prev();
            }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={() => {
              clearHold();
              setPaused(false);
            }}
            onTap={onTap}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute inset-0 touch-pan-y overflow-hidden bg-[#141414] text-white sm:rounded-2xl"
          >
            {s.photo && failedId === s.id ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-white/60">
                <ImageOff className="h-8 w-8" strokeWidth={1.5} />
                <span className="text-sm">Photo unavailable</span>
              </div>
            ) : s.photo ? (
              <img
                src={s.photo}
                alt=""
                draggable={false}
                ref={(img) => {
                  // Already in the cache: it may have loaded before onLoad was attached.
                  if (img?.complete && img.naturalWidth > 0) setLoadedId(s.id);
                }}
                onLoad={() => setLoadedId(s.id)}
                onError={() => setFailedId(s.id)}
                className={`h-full w-full object-contain transition-opacity duration-500 ${
                  imgReady ? "opacity-100" : "opacity-0"
                }`}
              />
            ) : (
              <SparkPrint s={s} textClass="px-10 text-3xl sm:text-4xl" />
            )}

            {/* Sparked: a warm flash from the middle */}
            {burst > 0 && (
              <span
                key={burst}
                className="pointer-events-none absolute inset-0 animate-[spark-warm_0.9s_ease-out_both]"
                style={{
                  background: `radial-gradient(circle at 50% 50%, rgba(${EMBER},0.55), transparent 65%)`,
                }}
              />
            )}

            {/* Top: fuse + who */}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/65 to-transparent px-4 pb-10 pt-4">
              <Fuse
                count={run.length}
                pos={pos}
                progress={progress}
                rgb={rgb}
              />
              <div className="mt-3.5 flex items-center gap-2.5 pr-10">
                <Avatar
                  src={s.author.profile_photo}
                  alt={s.author.username}
                  className="h-9 w-9"
                />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-semibold">
                    {s.mine ? "You" : nameOf(s.author)}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-white/70">
                    {timeOf(s.created_at)}
                    {run.length > 1 && (
                      <span>
                        · {pos + 1} of {run.length}
                      </span>
                    )}
                    {s.close_friends_only && (
                      <span className="flex items-center gap-0.5 font-semibold text-[#f5c060]">
                        <Star className="h-3 w-3" fill="currentColor" /> Close
                        friends
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Caption */}
            {s.photo && s.text && (
              <p className="absolute inset-x-5 bottom-24 text-center text-[15px] font-medium [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
                {s.text}
              </p>
            )}

            {showHint && (
              <p className="absolute inset-x-0 bottom-[4.75rem] text-center text-xs text-white/50">
                Swipe for the next one · hold to spark it
              </p>
            )}
          </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10 sm:rounded-b-2xl">
          {s.mine ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatsOpen(true)}
                className="flex cursor-pointer items-center gap-3 rounded-full bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25"
              >
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" /> {s.views ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <Flame className="h-4 w-4" /> {s.warms ?? 0}
                </span>
              </button>
              <button
                type="button"
                onClick={remove}
                aria-label="Delete spark"
                title="Delete spark"
                className="ml-auto cursor-pointer rounded-full bg-white/15 p-2 text-white hover:bg-red-500/80"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSpark}
                aria-pressed={isWarmed}
                title={isWarmed ? "Tap to unspark" : "Spark it"}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  isWarmed
                    ? "bg-[var(--button-color-bg)] text-white"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                <Flame
                  key={isWarmed ? "on" : "off"}
                  className={`h-4 w-4 ${isWarmed ? "animate-in zoom-in-50 duration-300" : ""}`}
                  fill={isWarmed ? "currentColor" : "none"}
                />
                {isWarmed ? "Sparked" : "Spark it"}
              </button>
              <button
                type="button"
                onClick={() => setKudosOpen(true)}
                disabled={kudosSent}
                title={kudosSent ? "You sent kudos today" : undefined}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/25 disabled:cursor-default disabled:bg-white/10 disabled:text-white/50"
              >
                {kudosSent ? (
                  <>
                    <Check className="h-4 w-4" /> Sent
                  </>
                ) : (
                  <>
                    <Heart className="h-4 w-4" /> Kudos
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {statsOpen && (
          <StatsPanel id={s.id} onClose={() => setStatsOpen(false)} />
        )}
      </div>

      {!s.mine && (
        <SendGlowDialog
          open={kudosOpen}
          onOpenChange={setKudosOpen}
          recipient={{
            id: s.author.id,
            username: s.author.username,
            firstname: s.author.firstname,
            profile_photo: s.author.profile_photo,
          }}
        />
      )}
    </div>
  );
};

export default SparkViewer;
