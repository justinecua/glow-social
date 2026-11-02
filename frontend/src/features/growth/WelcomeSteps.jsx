import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useGetOnboardingQuery } from "@/redux/services/growth";

const storageKey = (accountId) => `glow_welcome_dismissed_${accountId}`;

// "1" = dismissed by the user, "done" = all steps completed. Either way,
// don't show (or reserve space for) the card again.
const readDismissed = (accountId) => {
  try {
    const v = localStorage.getItem(storageKey(accountId));
    return v === "1" || v === "done";
  } catch {
    return false;
  }
};

const WelcomeSkeleton = () => (
  <section className="mb-3 rounded-xl bg-[var(--home-card)] p-5" aria-hidden>
    <Skeleton className="h-4 w-40" />
    <Skeleton className="mt-2 h-3 w-64" />
    <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
    <div className="mt-4 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  </section>
);

/** Three first steps for new users, shown on the feed until done. */
const WelcomeSteps = ({ accountId, onCreatePost }) => {
  const [dismissed, setDismissed] = useState(() => readDismissed(accountId));
  const { data, isLoading } = useGetOnboardingQuery(undefined, {
    skip: dismissed,
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (data?.done) {
      try {
        localStorage.setItem(storageKey(accountId), "done");
      } catch {
        /* ignore */
      }
    }
  }, [data?.done, accountId]);

  if (dismissed) return null;
  if (isLoading) return <WelcomeSkeleton />;
  if (!data || data.done) return null;

  const steps = [
    {
      done: data.steps.photo,
      title: "Add a profile photo",
      text: "Help friends recognise you.",
      action: <Link to={`/profile/${accountId}`}>Add photo</Link>,
    },
    {
      done: data.steps.friends,
      title: "Connect with 3 people",
      text: `${Math.min(data.friends_count, 3)}/3 so far. Find people on Explore.`,
      action: <Link to="/explore">Find people</Link>,
    },
    {
      done: data.steps.post,
      title: "Share your first post",
      text: "Say hi to everyone.",
      action: (
        <button type="button" onClick={onCreatePost} className="cursor-pointer">
          Write a post
        </button>
      ),
    },
  ];
  const completed = steps.filter((s) => s.done).length;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey(accountId), "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="mb-3 rounded-xl bg-[var(--home-card)] p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Welcome to Glow 👋</h2>
          <p className="text-sm text-[var(--color-subtitle)]">
            {completed} of 3 done: finish these to get the most out of Glow.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide welcome steps"
          className="cursor-pointer rounded-full p-1 text-[var(--color-subtitle)] hover:bg-[var(--photo-bg)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--photo-bg)]">
        <div
          className="h-full rounded-full bg-[var(--button-color-bg)] transition-all"
          style={{ width: `${(completed / 3) * 100}%` }}
        />
      </div>

      <ol className="mt-4 flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.title} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                s.done ? "border-transparent bg-[var(--button-color-bg)] text-white" : ""
              }`}
            >
              {s.done && <Check className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${s.done ? "line-through opacity-60" : "font-medium"}`}>
                {s.title}
              </p>
              {!s.done && <p className="text-xs text-[var(--color-subtitle)]">{s.text}</p>}
            </div>
            {!s.done && (
              <span className="shrink-0 text-xs font-semibold text-[var(--button-color-bg)] hover:underline dark:text-white">
                {s.action}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
};

export default WelcomeSteps;
