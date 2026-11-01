import { Link } from "react-router-dom";
import { CheckCircle2, Compass } from "lucide-react";
import { useGetExploreQuery } from "@/redux/services/discover";
import { Avatar } from "@/features/discover/components/PersonRow";

/** End-of-feed card: you have seen every post. */
const CaughtUpCard = () => {
  const { data } = useGetExploreQuery(undefined);
  const people = (data?.people ?? []).slice(0, 5);

  return (
    <section className="my-4 rounded-xl border border-dashed bg-[var(--home-card)] p-5 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--button-color-bg)]" />
      <h2 className="mt-2 font-semibold">
        You're all caught up
      </h2>
      <p className="mt-1 text-sm text-[var(--color-subtitle)]">
        You've seen every post. Find more people to follow on Explore.
      </p>

      {people.length > 0 && (
        <div className="mt-4 flex justify-center -space-x-2">
          {people.map((p: any) => (
            <Link key={p.id} to={`/profile/${p.id}`} title={`@${p.username}`}>
              <Avatar
                src={p.profile_photo}
                alt={p.username}
                className="h-9 w-9 ring-2 ring-[var(--home-card)]"
              />
            </Link>
          ))}
        </div>
      )}

      <Link
        to="/explore"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--button-color-bg)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        <Compass className="h-4 w-4" /> Discover on Explore
      </Link>
    </section>
  );
};

export default CaughtUpCard;
