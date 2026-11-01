import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useVotePollMutation } from "@/redux/services/posts/posts";
import { useStoredUser } from "@/utils/auth";
import { useNavigate } from "react-router-dom";

function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Final results";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m left`;
}

/** Vote buttons until you've voted (or it ends), then result bars. */
const PollView = ({ postId, poll: initial }) => {
  const [poll, setPoll] = useState(initial);
  const [pending, setPending] = useState(null);
  const [vote] = useVotePollMutation();
  const user = useStoredUser();
  const navigate = useNavigate();
  useEffect(() => setPoll(initial), [initial]);

  const showResults = poll.my_vote !== null || poll.closed;

  const choose = async (optionId) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setPending(optionId);
    try {
      const updated = await vote({ post_id: postId, option_id: optionId }).unwrap();
      setPoll(updated);
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't save your vote.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      {poll.options.map((o) => {
        if (!showResults) {
          return (
            <button
              key={o.id}
              type="button"
              disabled={pending !== null}
              onClick={() => choose(o.id)}
              className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-[var(--button-color-bg)] px-4 text-sm font-medium text-[var(--button-color-bg)] transition-colors hover:bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] disabled:opacity-60 dark:text-[var(--title-color)]"
            >
              {pending === o.id && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="truncate">{o.text}</span>
            </button>
          );
        }
        const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
        const mine = poll.my_vote === o.id;
        const correct = poll.is_quiz && poll.correct_option === o.id;
        const wrong = poll.is_quiz && mine && !correct;
        const fill = correct
          ? "bg-emerald-500/25"
          : wrong
            ? "bg-red-500/20"
            : mine
              ? "bg-[color-mix(in_srgb,var(--button-color-bg)_28%,transparent)]"
              : "bg-[var(--button-hover-bg-color)]";
        return (
          <div key={o.id} className="relative h-10 overflow-hidden rounded-lg">
            <div
              className={`absolute inset-y-0 left-0 rounded-lg transition-[width] duration-500 ${fill}`}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
            <div className="relative flex h-full items-center gap-2 px-3 text-sm">
              <span className={`min-w-0 flex-1 truncate ${mine || correct ? "font-semibold" : ""}`}>
                {o.text}
              </span>
              {correct && (
                <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Correct answer" />
              )}
              {wrong && <X className="h-4 w-4 shrink-0 text-red-500" aria-label="Your answer" />}
              {mine && !poll.is_quiz && (
                <Check
                  className="h-4 w-4 shrink-0 text-[var(--button-color-bg)]"
                  aria-label="Your vote"
                />
              )}
              <span className="w-10 shrink-0 text-right tabular-nums font-medium">{pct}%</span>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-[var(--color-subtitle)]">
        {poll.total} {poll.total === 1 ? "vote" : "votes"} · {timeLeft(poll.ends_at)}
        {poll.is_quiz && showResults && poll.my_vote !== null && (
          <span className="ml-1 font-medium">
            ·{" "}
            {poll.correct_option === poll.my_vote
              ? "You got it right! 🎉"
              : "Not quite. Better luck next time!"}
          </span>
        )}
      </p>
    </div>
  );
};

export default PollView;
