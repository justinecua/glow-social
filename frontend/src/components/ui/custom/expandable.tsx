import { useState } from "react";
import { Linkified } from "@/features/posts/LinkPreview";

const LIMIT = 220;      // characters shown before "Show more"
const MAX_LINES = 6;    // ...or lines, for posts like lists and trivia options

/** Cut at a word (or line) boundary near the limit, never mid-word. */
function preview(text: string) {
  const lines = text.split("\n");
  let cut = lines.length > MAX_LINES ? lines.slice(0, MAX_LINES).join("\n") : text;
  if (cut.length > LIMIT) {
    cut = cut.slice(0, LIMIT);
    const space = cut.search(/\s\S*$/);
    if (space > LIMIT * 0.6) cut = cut.slice(0, space);
  }
  return cut === text ? null : cut.trimEnd();
}

const ExpandableText = ({ text }) => {
  const [showFull, setShowFull] = useState(false);
  const short = preview(text);
  // Left-aligned (not justified: that stretches the spaces between words) and
  // keeping the author's line breaks.
  const cls = "text-sm mt-3 w-full whitespace-pre-line leading-relaxed [overflow-wrap:anywhere]";

  if (!short) {
    return <p className={cls}><Linkified text={text} /></p>;
  }

  return (
    <p className={cls}>
      <Linkified text={showFull ? text : short + "…"} />
      <button
        type="button"
        onClick={() => setShowFull(!showFull)}
        className="ml-1 cursor-pointer text-sm font-medium text-[var(--color-subtitle)] hover:underline"
      >
        {showFull ? "Show less" : "Show more"}
      </button>
    </p>
  );
};

export default ExpandableText;
