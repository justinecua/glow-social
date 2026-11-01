import { Link } from "react-router-dom";
import { useGetWeeklyGlowsQuery } from "@/redux/services/growth";
import { Avatar } from "@/features/discover/components/PersonRow";
import { ChainPeople } from "./GlowChainDialog";
import { formatCount } from "@/lib/formatCount";

/** Explore section: this week's longest glow chain and most-glowed people. */
const WeeklyGlows = () => {
  const { data } = useGetWeeklyGlowsQuery(undefined);
  const chain = data?.longest_chain;
  const top = data?.most_glowed ?? [];
  if (!chain && top.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl bg-[color-mix(in_srgb,var(--button-color-bg)_8%,transparent)] p-5 dark:bg-[color-mix(in_srgb,var(--button-color-bg)_18%,transparent)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
        Glows this week
      </h2>

      {chain && (
        <div className="mt-4">
          <p className="mb-2 text-sm">
            <span className="font-semibold">Longest chain:</span> {chain.length} glows passed on
          </p>
          <ChainPeople people={chain.people} />
        </div>
      )}

      {top.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold">Most appreciated</p>
          <div className="flex flex-wrap gap-2">
            {top.map((p: any, i: number) => (
              <Link
                key={p.id}
                to={`/profile/${p.id}?tab=glows`}
                className="flex items-center gap-2 rounded-full bg-[var(--home-card)] py-1 pl-1 pr-3 text-xs hover:bg-[var(--button-hover-bg-color)]"
              >
                <Avatar src={p.profile_photo} alt={p.username} className="h-7 w-7" />
                <span className="font-semibold">
                  {i === 0 ? "🏆 " : ""}@{p.username}
                </span>
                <span className="text-[var(--color-subtitle)]">{formatCount(p.glows)} {p.glows === 1 ? "glow" : "glows"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default WeeklyGlows;
