import { useGetUnreadMessagesQuery } from "@/redux/services/messages";
import { formatCount } from "@/lib/formatCount";

/** Red dot with the number of chats that have unread messages. */
const UnreadBadge = ({ className = "" }) => {
  const { data } = useGetUnreadMessagesQuery(undefined, { pollingInterval: 5 * 60_000 /* fallback: chat events refresh it live */ });
  const n = data?.unread ?? 0;
  if (!n) return null;
  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ${className}`}
      aria-label={`${n} unread ${n === 1 ? "chat" : "chats"}`}
    >
      {formatCount(n)}
    </span>
  );
};

export default UnreadBadge;
