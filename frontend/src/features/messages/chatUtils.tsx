import { Avatar } from "@/features/discover/components/PersonRow";
import type { ChatPerson, Conversation } from "@/redux/services/messages";

export const personName = (p?: ChatPerson | null) =>
  p ? [p.firstname, p.lastname].filter(Boolean).join(" ") || p.username : "Someone";

export const otherMembers = (c: Conversation, myId?: number) =>
  c.members.filter((m) => m.id !== myId);

/** Avatar for a chat: the other person, or two overlapping faces for groups. */
export const ChatAvatar = ({
  conversation,
  myId,
  size = "h-11 w-11",
}: {
  conversation: Conversation;
  myId?: number;
  size?: string;
}) => {
  const others = otherMembers(conversation, myId);
  if (!conversation.is_group) {
    const o = others[0];
    return <Avatar src={o?.profile_photo} alt={o?.username ?? ""} className={size} />;
  }
  const [a, b] = others;
  return (
    <span className={`relative inline-block shrink-0 ${size}`}>
      <Avatar src={a?.profile_photo} alt={a?.username ?? ""} className="absolute left-0 top-0 h-[70%] w-[70%]" />
      <Avatar
        src={b?.profile_photo}
        alt={b?.username ?? ""}
        className="absolute bottom-0 right-0 h-[70%] w-[70%] ring-2 ring-[var(--home-card)]"
      />
    </span>
  );
};

/** "now", "5m", "3h", "Mon", "Oct 3" */
export const shortTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 6 * 86400) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** "Today", "Yesterday", or a date, for separators between days. */
export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};
