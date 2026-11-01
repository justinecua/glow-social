import { useState } from "react";
import { Linkified } from "@/features/posts/LinkPreview";

const ExpandableText = ({ text }) => {
  const [showFull, setShowFull] = useState(false);
  const limit = 150;

  if (text.length <= limit) {
    return <p className="text-sm mt-3 w-full text-justify [overflow-wrap:anywhere]"><Linkified text={text} /></p>;
  }

  const displayText = showFull ? text : text.slice(0, limit) + "...";

  return (
    <p className="text-sm mt-3 w-full text-justify [overflow-wrap:anywhere]">
      <Linkified text={displayText} />
      <button
        onClick={() => setShowFull(!showFull)}
        className="ml-1 text-xs font-medium cursor-pointer"
      >
        {showFull ? "Show less" : "Show more"}
      </button>
    </p>
  );
};

export default ExpandableText;
