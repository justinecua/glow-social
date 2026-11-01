import { Link } from "react-router-dom";
import { Sun, Link2, Trophy, ChevronRight } from "lucide-react";
import { useGetWeeklyGlowsQuery } from "@/redux/services/growth";
import { Avatar } from "@/features/discover/components/PersonRow";
import { ChainPeople } from "./GlowChainDialog";
import { formatCount } from "@/lib/formatCount";

const RANK_STYLES = [
  "bg-amber-400/20 text-amber-600 dark:text-amber-400",
  "bg-slate-400/20 text-slate-600 dark:text-slate-300",
  "bg-orange-400/20 text-orange-700 dark:text-orange-400",
];

/** Explore section: this week's longest glow chain and most-glowed people. */
const WeeklyGlows = () => {
  const { data } = useGetWeeklyGlowsQuery(undefined);
  const chain = data?.longest_chain;
  const top = data?.most_glowed ?? [];
  if (!chain && top.length === 0) return null;

  const both = chain && top.length > 0;

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border bg-[var(--home-card)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-[color-mix(in_srgb,var(--button-color-bg)_8%,transparent)] px-5 py-4 dark:bg-[color-mix(in_srgb,var(--button-color-bg)_16%,transparent)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--button-color-bg)] text-white">
          <Sun className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold leading-tight">Kudos this week</h2>
          <p className="text-xs text-[var(--color-subtitle)]">
            Who's spreading the most appreciation
          </p>
        </div>
      </div>

      <div className={`grid gap-4 p-5 ${both ? "md:grid-cols-2" : ""}`}>
        {chain && (
          <div className="rounded-xl bg-[var(--photo-bg)] p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-subtitle)]">
              <Link2 className="h-3.5 w-3.5" /> Longest chain
            </div>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-[var(--button-color-bg)]">
                {chain.length}
              </span>
              <span className="text-sm text-[var(--color-subtitle)]">kudos passed on</span>
            </p>
            <div className="mt-3">
              <ChainPeople people={chain.people} />
            </div>
          </div>
        )}

        {top.length > 0 && (
          <div className="rounded-xl bg-[var(--photo-bg)] p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--color-subtitle)]">
              <Trophy className="h-3.5 w-3.5" /> Most appreciated
            </div>
            <ol className="mt-3 space-y-1">
              {top.map((p, i) => (
                <li key={p.id}>
                  <Link
                    to={`/profile/${p.id}?tab=glows`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--home-card)]"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        RANK_STYLES[i] ?? "text-[var(--color-subtitle)]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <Avatar src={p.profile_photo} alt={p.username} className="h-9 w-9" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      @{p.username}
                    </span>
                    <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--button-color-bg)_12%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[var(--button-color-bg)]">
                      {formatCount(p.glows)} kudos
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-subtitle)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
};

export default WeeklyGlows;
