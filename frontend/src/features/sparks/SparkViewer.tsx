import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Flame, Heart, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  SPARK_BACKGROUNDS,
  useDeleteSparkMutation,
  useGetSparkStatsQuery,
  useViewSparkMutation,
  useWarmSparkMutation,
  type Spark,
} from "@/redux/services/sparks";
import { Avatar } from "@/features/discover/components/PersonRow";
import SendGlowDialog from "@/features/glows/SendGlowDialog";

const DURATION_MS = 5000;
const HOLD_MS = 450;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const nameOf = (a: Spark["author"]) => [a.firstname, a.lastname].filter(Boolean).join(" ") || a.username;

/** Who viewed/warmed your spark. */
const StatsPanel = ({ id, onClose }: { id: number; onClose: () => void }) => {
  const { data, isLoading } = useGetSparkStatsQuery(id);
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-2xl bg-[var(--home-card)] p-4 text-[var(--title-color)]" onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center">
        <p className="text-sm font-semibold">
          {data ? `${data.views} ${data.views === 1 ? "view" : "views"} · ${data.warms} ${data.warms === 1 ? "warm" : "warms"}` : "Viewers"}
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="ml-auto cursor-pointer rounded-full p-1 hover:bg-[var(--button-hover-bg-color)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      {isLoading && <p className="text-sm text-[var(--color-subtitle)]">Loading…</p>}
      {data && data.viewers.length === 0 && <p className="text-sm text-[var(--color-subtitle)]">No one has seen it yet.</p>}
      <ul className="flex flex-col gap-2">
        {data?.viewers.map((v: any) => (
          <li key={v.id} className="flex items-center gap-3">
            <Avatar src={v.profile_photo} alt={v.username} className="h-8 w-8" />
            <span className="flex-1 truncate text-sm">{[v.firstname, v.lastname].filter(Boolean).join(" ") || v.username}</span>
            {v.warmed && <Flame className="h-4 w-4 text-orange-500" aria-label="Warmed" />}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Full-screen player. Moves through sparks by TIME (everyone's day in
 *  order), not person by person. Hold to warm; tap sides to skip. */
const SparkViewer = ({
  sparks,
  startIndex,
  onClose,
}: {
  sparks: Spark[];
  startIndex: number;
  onClose: () => void;
}) => {
  // Freeze the list for this session so it doesn't shift while watching.
  const list = useMemo(() => sparks, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [kudosOpen, setKudosOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const [imgReady, setImgReady] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const held = useRef(false);

  const [viewSpark] = useViewSparkMutation();
  const [warmSpark] = useWarmSparkMutation();
  const [deleteSpark] = useDeleteSparkMutation();

  const s = list[i];
  const [warmed, setWarmed] = useState<Record<number, boolean>>({});
  const isWarmed = s ? warmed[s.id] ?? s.warmed : false;

  const next = useCallback(() => {
    if (i < list.length - 1) setI(i + 1);
    else onClose();
  }, [i, list.length, onClose]);
  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  // Reset per spark; mark it seen.
  useEffect(() => {
    setProgress(0);
    setStatsOpen(false);
    setImgReady(!list[i]?.photo);
    const cur = list[i];
    if (cur && !cur.mine && !cur.seen) viewSpark(cur.id);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer (paused while holding, reading stats, sending kudos or loading).
  const halted = paused || statsOpen || kudosOpen || !imgReady;
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

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  const doWarm = () => {
    if (s.mine || isWarmed) return;
    setWarmed((w) => ({ ...w, [s.id]: true }));
    setBurst((b) => b + 1);
    warmSpark(s.id);
  };

  const onPointerDown = () => {
    setPaused(true);
    held.current = false;
    holdTimer.current = window.setTimeout(() => {
      held.current = true;
      doWarm();
    }, HOLD_MS);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    setPaused(false);
    if (held.current) return; // it was a hold, not a tap
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev();
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

  const prevS = list[i - 1];
  const nextS = list[i + 1];

  return (
    <div className={`fixed inset-0 ${kudosOpen ? "z-40" : "z-[400]"} flex items-center justify-center bg-black/90 backdrop-blur-sm`} role="dialog" aria-label="Sparks">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-30 cursor-pointer rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white">
        <X className="h-6 w-6" />
      </button>

      {/* Desktop arrows */}
      {prevS && (
        <button type="button" onClick={prev} aria-label="Previous" className="absolute left-[calc(50%-260px)] hidden cursor-pointer rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:block">
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {nextS && (
        <button type="button" onClick={next} aria-label="Next" className="absolute right-[calc(50%-260px)] hidden cursor-pointer rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:block">
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div className="relative flex h-[100dvh] w-full max-w-[420px] select-none flex-col overflow-hidden bg-black text-white sm:h-[min(92dvh,760px)] sm:rounded-2xl">
        {/* Progress: one bar for the current spark + position in the day */}
        <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-3">
          <div className="h-[3px] overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar src={s.author.profile_photo} alt={s.author.username} className="h-9 w-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{s.mine ? "Your spark" : nameOf(s.author)}</p>
              <p className="text-xs text-white/70">
                {timeOf(s.created_at)} · {i + 1} of {list.length} today
              </p>
            </div>
            {s.close_friends_only && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#f5a524]/90 px-2 py-0.5 text-[10px] font-semibold text-black">
                <Star className="h-3 w-3" fill="currentColor" /> Close friends
              </span>
            )}
          </div>
        </div>

        {/* Content (tap sides to move, hold to warm) */}
        <div
          className="relative flex flex-1 items-center justify-center"
          style={!s.photo ? { background: SPARK_BACKGROUNDS[s.background] || SPARK_BACKGROUNDS.sunrise } : undefined}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            if (holdTimer.current) window.clearTimeout(holdTimer.current);
            setPaused(false);
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {s.photo ? (
            <>
              <img
                key={s.id}
                src={s.photo}
                alt=""
                draggable={false}
                onLoad={() => setImgReady(true)}
                onError={() => setImgReady(true)}
                className="max-h-full w-full object-contain"
              />
              {s.text && (
                <p className="absolute inset-x-6 bottom-28 rounded-xl bg-black/45 px-3 py-2 text-center text-[15px] font-medium backdrop-blur-sm">
                  {s.text}
                </p>
              )}
            </>
          ) : (
            <p className="whitespace-pre-line px-8 text-center text-2xl font-bold leading-snug [text-shadow:0_1px_8px_rgba(0,0,0,0.25)]">
              {s.text}
            </p>
          )}

          {/* Warm burst */}
          {burst > 0 && (
            <span key={burst} className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Flame className="h-24 w-24 animate-in zoom-in-50 fade-in fill-orange-400 text-orange-300 drop-shadow-[0_0_24px_rgba(255,140,40,0.9)] duration-300" />
            </span>
          )}
        </div>

        {/* Bottom bar */}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
          <div className="mb-3 flex items-center justify-between text-[11px] text-white/60">
            <span>{prevS ? `◀ ${timeOf(prevS.created_at)}` : ""}</span>
            <span>{nextS ? `${timeOf(nextS.created_at)} ▶` : "end of today"}</span>
          </div>

          {s.mine ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setStatsOpen(true)} className="flex cursor-pointer items-center gap-3 rounded-full bg-white/15 px-4 py-2 text-sm hover:bg-white/25">
                <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> {s.views ?? 0}</span>
                <span className="flex items-center gap-1"><Flame className="h-4 w-4" /> {s.warms ?? 0}</span>
              </button>
              <button type="button" onClick={remove} aria-label="Delete spark" title="Delete spark" className="ml-auto cursor-pointer rounded-full bg-white/15 p-2 hover:bg-red-500/80">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={doWarm}
                disabled={isWarmed}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  isWarmed ? "bg-orange-500/90 text-white" : "bg-white/15 hover:bg-white/25"
                }`}
              >
                <Flame className={`h-4 w-4 ${isWarmed ? "fill-white" : ""}`} />
                {isWarmed ? "Warmed" : "Hold to warm"}
              </button>
              <button
                type="button"
                onClick={() => setKudosOpen(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/25"
              >
                <Heart className="h-4 w-4" /> Kudos
              </button>
            </div>
          )}
        </div>

        {statsOpen && <StatsPanel id={s.id} onClose={() => setStatsOpen(false)} />}
      </div>

      {!s.mine && (
        <SendGlowDialog
          open={kudosOpen}
          onOpenChange={setKudosOpen}
          recipient={{ id: s.author.id, username: s.author.username, firstname: s.author.firstname }}
        />
      )}
    </div>
  );
};

export default SparkViewer;
