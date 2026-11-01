import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircleHeart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetTodayPromptQuery } from "@/redux/services/growth";

const KEY = "glow_prompt_dismissed";

/** Today's question at the top of the feed. Hidden for the rest of the day
 *  once dismissed (per browser). */
const DailyPromptCard = ({
  signedIn,
  onAnswer,
}: {
  signedIn: boolean;
  onAnswer: (prompt: { text: string; tag: string }) => void;
}) => {
  const { data: prompt, isLoading } = useGetTodayPromptQuery(undefined);
  const [dismissedFor, setDismissedFor] = useState(() => {
    try {
      return localStorage.getItem(KEY) || "";
    } catch {
      return "";
    }
  });

  // Reserve the card's space while loading, unless it was hidden today.
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  if (isLoading && dismissedFor !== today) {
    return (
      <section
        className="mb-3 flex items-start gap-3 rounded-xl bg-[var(--home-card)] p-4"
        aria-hidden
      >
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <div className="mt-3 flex items-center gap-3">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </section>
    );
  }
  if (!prompt || dismissedFor === prompt.date) return null;

  const dismiss = () => {
    setDismissedFor(prompt.date);
    try {
      localStorage.setItem(KEY, prompt.date);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="mb-3 flex items-start gap-3 rounded-xl bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] p-4 dark:bg-[color-mix(in_srgb,var(--button-color-bg)_20%,transparent)]">
      <span className="rounded-lg bg-[var(--button-color-bg)] p-2 text-white">
        <MessageCircleHeart className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-subtitle)]">
          Today's prompt
        </p>
        <p className="mt-0.5 font-semibold">{prompt.text}</p>
        <div className="mt-3 flex items-center gap-3">
          {signedIn ? (
            <Button
              size="sm"
              onClick={() => onAnswer(prompt)}
              className="cursor-pointer bg-[var(--button-color-bg)] text-white hover:opacity-90"
            >
              Answer
            </Button>
          ) : (
            <Button size="sm" asChild className="bg-[var(--button-color-bg)] text-white hover:opacity-90">
              <Link to="/register">Join to answer</Link>
            </Button>
          )}
          {prompt.tag && (
            <Link
              to={`/explore?tag=${encodeURIComponent(prompt.tag)}`}
              className="text-xs text-[var(--color-subtitle)] hover:underline"
            >
              See answers #{prompt.tag}
            </Link>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide today's prompt"
        className="cursor-pointer rounded-full p-1 text-[var(--color-subtitle)] hover:bg-[var(--photo-bg)]"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
};

export default DailyPromptCard;
