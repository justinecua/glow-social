import { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, MessageCircle, X } from "lucide-react";
import { useGetTodayPromptQuery } from "@/redux/services/posts/posts";
import { Avatar } from "@/features/discover/components/PersonRow";

const dismissKey = (date) => `glow_prompt_dismissed_${date}`;

/** Today's prompt or photo challenge, above the feed. Dismissible per day. */
const PromptCard = ({ onAnswer }) => {
  const { data } = useGetTodayPromptQuery(undefined);
  const [hidden, setHidden] = useState(false);

  if (!data || hidden) return null;
  try {
    if (localStorage.getItem(dismissKey(data.date))) return null;
  } catch {
    /* storage blocked: just show it */
  }

  const challenge = data.kind === "challenge";
  const Icon = challenge ? Camera : MessageCircle;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(dismissKey(data.date), "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="mb-3 rounded-xl border bg-[var(--home-card)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--button-color-bg)]">
        <Icon className="h-3.5 w-3.5" />
        {challenge ? "Photo challenge" : "Today's prompt"}
        <span className="text-[var(--color-subtitle)]">· #{data.tag}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide for today"
          title="Hide for today"
          className="ml-auto -mr-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-1.5 text-[15px] font-semibold leading-snug">{data.text}</p>

      <div className="mt-3 flex items-center gap-3">
        {data.count > 0 ? (
          <Link
            to={`/explore?tag=${encodeURIComponent(data.tag)}`}
            className="flex min-w-0 items-center gap-2 text-xs text-[var(--color-subtitle)] hover:underline"
          >
            <span className="flex shrink-0 -space-x-1.5">
              {data.people.map((p) => (
                <span
                  key={p.id}
                  className="block h-6 w-6 overflow-hidden rounded-full ring-2 ring-[var(--home-card)]"
                >
                  <Avatar src={p.profile_photo} alt={p.username} className="h-6 w-6" />
                </span>
              ))}
            </span>
            <span className="truncate">
              {data.count} {data.count === 1 ? "post" : "posts"} today · See all
            </span>
          </Link>
        ) : (
          <span className="text-xs text-[var(--color-subtitle)]">Be the first to answer today</span>
        )}
        <button
          type="button"
          onClick={() => onAnswer({ text: data.text, tag: data.tag })}
          className="ml-auto h-8 shrink-0 cursor-pointer rounded-full bg-[var(--button-color-bg)] px-4 text-sm font-semibold text-white hover:opacity-90"
        >
          {challenge ? "Join" : "Answer"}
        </button>
      </div>
    </section>
  );
};

export default PromptCard;
