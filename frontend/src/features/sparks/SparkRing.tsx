import { useEffect, useState } from "react";
import { openSparks, useGetSparksQuery } from "@/redux/services/sparks";
import { useStoredUser } from "@/utils/auth";

const DAY_MS = 24 * 3600 * 1000;

/** Ring info for an account: null if they have no sparks you can see. */
export function useSparkRing(accountId?: number | string) {
  const user = useStoredUser();
  const { data } = useGetSparksQuery(undefined, { skip: !user });
  // Re-render every few minutes so the ring keeps fading.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 5 * 60 * 1000);
    return () => window.clearInterval(t);
  }, []);
  const a = accountId != null ? data?.authors?.[String(accountId)] : null;
  if (!a?.latest) return null;
  const age = Date.now() - new Date(a.latest).getTime();
  // 1 = just posted, fading to 0.25 at 24h.
  const brightness = Math.max(0.25, Math.min(1, 1 - age / DAY_MS));
  return { unseen: !!a.unseen, close: !!a.close, brightness };
}

/** Wraps an avatar. When the person has sparks, draws a glowing ring that
 *  fades as their latest spark ages (gold = Close Friends, grey = seen) and
 *  opens their sparks on click. Otherwise renders the avatar unchanged. */
const SparkRing = ({
  accountId,
  children,
  width = 2.5,
  className = "",
}: {
  accountId?: number | string;
  children: React.ReactNode;
  width?: number;
  className?: string;
}) => {
  const ring = useSparkRing(accountId);
  if (!ring) return <>{children}</>;

  const colors = ring.close ? ["#ffd66b", "#f5a524"] : ["#5b7cff", "#ff5fa2"];
  const glow = ring.close ? "245,165,36" : "120,110,255";
  const style: React.CSSProperties = ring.unseen
    ? {
        background: `conic-gradient(from 210deg, ${colors[0]}, ${colors[1]}, ${colors[0]})`,
        opacity: 0.35 + 0.65 * ring.brightness,
        boxShadow: `0 0 ${4 + 14 * ring.brightness}px rgba(${glow},${0.25 + 0.45 * ring.brightness})`,
      }
    : { background: "var(--color-subtitle)", opacity: 0.35 };

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="View sparks"
      title={ring.unseen ? "New spark" : "Sparks"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openSparks({ authorId: Number(accountId) });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSparks({ authorId: Number(accountId) });
        }
      }}
      className={`relative inline-flex shrink-0 cursor-pointer rounded-full ${className}`}
      style={{ padding: width + 1.5 }}
    >
      <span aria-hidden className="absolute inset-0 rounded-full transition-opacity" style={style} />
      <span className="relative rounded-full bg-[var(--home-card)]" style={{ padding: 1.5 }}>
        {children}
      </span>
    </span>
  );
};

export default SparkRing;
