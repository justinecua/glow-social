import { Link } from "react-router-dom";
import { MessageCircle, SquarePen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetConversationsQuery } from "@/redux/services/messages";
import { formatCount } from "@/lib/formatCount";
import { ChatAvatar, personName, shortTime } from "./chatUtils";

const ConversationList = ({
  myId,
  activeId,
  onNewChat,
}: {
  myId?: number;
  activeId?: number;
  onNewChat: () => void;
}) => {
  const { data, isLoading } = useGetConversationsQuery(undefined);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-bold text-[var(--title-color)]">Messages</h1>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New message"
          title="New message"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--button-hover-bg-color)]"
        >
          <SquarePen className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
        {isLoading ? (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3" aria-hidden>
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))
        ) : !data?.length ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-3 rounded-full bg-[var(--photo-bg)] p-3 text-[var(--color-subtitle)]">
              <MessageCircle className="h-5 w-5" />
            </span>
            <p className="font-semibold">No messages yet</p>
            <button
              type="button"
              onClick={onNewChat}
              className="mt-4 cursor-pointer rounded-lg bg-[var(--button-color-bg)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Start a chat
            </button>
          </div>
        ) : (
          data.map((c) => {
            const lm = c.last_message;
            const unread = c.unread > 0;
            const sender =
              lm && lm.sender_id === myId
                ? "You: "
                : lm && c.is_group
                ? `${personName(c.members.find((m) => m.id === lm.sender_id)).split(" ")[0]}: `
                : "";
            const preview = !lm
              ? c.is_group ? "Group created" : "Say hi 👋"
              : lm.is_deleted
              ? "Message deleted"
              : lm.body;
            return (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                aria-current={c.id === activeId ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                  c.id === activeId
                    ? "bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] dark:bg-[color-mix(in_srgb,var(--button-color-bg)_22%,transparent)]"
                    : "hover:bg-[var(--button-hover-bg-color)]"
                }`}
              >
                <ChatAvatar conversation={c} myId={myId} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate text-sm ${unread ? "font-bold" : "font-medium"}`}>{c.name}</p>
                    <span className="shrink-0 text-[11px] text-[var(--color-subtitle)]">
                      {shortTime(lm?.created_at ?? c.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-xs ${
                        unread ? "font-semibold text-[var(--title-color)]" : "text-[var(--color-subtitle)]"
                      }`}
                    >
                      {sender}
                      {preview}
                    </p>
                    {unread && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--button-color-bg)] px-1.5 text-[10px] font-bold text-white">
                        {formatCount(c.unread)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;
