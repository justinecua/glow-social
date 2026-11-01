import { forwardRef, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/features/discover/components/PersonRow";
import { useStoredUser } from "@/utils/auth";
import { useWebSocket } from "@/utils/WebSocketContext";
import {
  useGetNotificationsByUserQuery,
  useMarkAllNotificationsReadMutation,
} from "@/redux/services/notifications/notifications";

type Notif = {
  id: number;
  status: "Unread" | "Read";
  content: string;
  created_at: string;
  notif_type: string;
  notif_from_id: number;
  notif_to_id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile_photo: string;
  friend_status?: "Pending" | "Friends" | "";
};

const name = (n: Notif) =>
  [n.firstname, n.lastname].filter(Boolean).join(" ") || n.username || "Someone";

/** The sentence for each kind of notification, with the person in bold. */
const Sentence = ({ n }: { n: Notif }) => {
  const who = <span className="font-semibold">{name(n)}</span>;
  switch (n.notif_type) {
    case "friend_request":
      return <>{who} sent you a friend request</>;
    case "friend_accepted":
      return <>{who} accepted your friend request</>;
    case "invite_joined":
      return <>{who} joined Glow from your invite. You're now friends.</>;
    case "glow_note": {
      const quote = n.content.match(/[“"](.*)[”"]$/)?.[1];
      return (
        <>
          {who} sent you kudos
          {quote && <span className="text-[var(--color-subtitle)]"> “{quote}”</span>}
        </>
      );
    }
    case "friends_posted":
      return <>{n.content}</>;
    default:
      return <>{n.content}</>;
  }
};

const href = (n: Notif) =>
  n.notif_type === "glow_note"
    ? `/profile/${n.notif_to_id}?tab=glows`
    : n.notif_type === "friends_posted"
      ? "/"
      : `/profile/${n.notif_from_id}`;

const NotifLeftBar = forwardRef<HTMLDivElement, { onNavigate?: () => void; leftOffset?: string }>(({ onNavigate, leftOffset = "21rem" }, ref) => {
  const user = useStoredUser();
  const accountId = user?.user?.account_id;
  const socketRef = useWebSocket();
  const { data, isLoading } = useGetNotificationsByUserQuery(
    { account_id: accountId },
    { skip: !accountId }
  );
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  // Answered requests, applied instantly (optimistic). Keyed by notification.
  const [responded, setResponded] = useState<Record<number, "accept" | "decline">>({});
  // Synchronous guard so a fast double-click can only send once.
  const answeredRef = useRef<Set<number>>(new Set());
  // Remember what was unread when the panel opened, so it stays highlighted
  // this time even though opening the panel marks everything read.
  const unreadOnOpen = useRef<Set<number> | null>(null);

  const list: Notif[] = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (!data || unreadOnOpen.current) return;
    unreadOnOpen.current = new Set(list.filter((n) => n.status === "Unread").map((n) => n.id));
    if (unreadOnOpen.current.size) markAllRead();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the server rejects an answer, undo it so the buttons come back.
  useEffect(() => {
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (
        (d?.type === "accept_friend_result" || d?.type === "cancel_friend_request") &&
        d.status === "error"
      ) {
        const failed = list.filter((n) => n.notif_from_id === d.friend_id).map((n) => n.id);
        if (!failed.length) return;
        failed.forEach((id) => answeredRef.current.delete(id));
        setResponded((r) => {
          const next = { ...r };
          failed.forEach((id) => delete next[id]);
          return next;
        });
        toast.error(d.message || "Couldn't update that request.");
      }
    };
    window.addEventListener("glow:ws", onEvent);
    return () => window.removeEventListener("glow:ws", onEvent);
  }, [list]);

  const respond = (n: Notif, action: "accept" | "decline") => {
    if (answeredRef.current.has(n.id)) return; // already answered
    const socket = socketRef?.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      toast.error("Connecting… please try again in a second.");
      return;
    }
    answeredRef.current.add(n.id);
    setResponded((r) => ({ ...r, [n.id]: action }));
    socket.send(
      JSON.stringify({
        type: action === "accept" ? "accept_friend_result" : "cancel_friend_request",
        friend_id: n.notif_from_id,
      })
    );
    if (action === "accept") toast.success(`You and ${name(n)} are now friends`);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      style={{ left: leftOffset }}
      className="fixed top-4 z-50 flex max-h-[calc(100vh-2rem)] w-[380px] flex-col overflow-hidden rounded-xl border bg-[var(--home-card)] shadow-2xl"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">Notifications</h3>
        {list.some((n) => n.status === "Unread") && (
          <button
            type="button"
            onClick={() => markAllRead()}
            className="cursor-pointer text-xs text-[var(--color-subtitle)] hover:text-[var(--title-color)] hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2 custom-scrollbar">
        {isLoading ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-3 p-2" aria-hidden>
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 rounded-full bg-[var(--photo-bg)] p-3 text-[var(--color-subtitle)]">
              <Bell className="h-5 w-5" />
            </span>
            <p className="font-semibold">No notifications yet</p>
          </div>
        ) : (
          list
            .filter((n) => responded[n.id] !== "decline") // declined: gone right away
            .map((n) => {
            const fresh = unreadOnOpen.current?.has(n.id) || n.status === "Unread";
            const isRequest = n.notif_type === "friend_request";
            const accepted =
              isRequest && (responded[n.id] === "accept" || n.friend_status === "Friends");
            const pending = isRequest && n.friend_status === "Pending" && !responded[n.id];
            return (
              <div
                key={n.id}
                className={`relative flex gap-3 rounded-lg p-2 transition-colors hover:bg-[var(--button-hover-bg-color)] ${
                  fresh
                    ? "bg-[color-mix(in_srgb,var(--button-color-bg)_8%,transparent)] dark:bg-[color-mix(in_srgb,var(--button-color-bg)_16%,transparent)]"
                    : ""
                }`}
              >
                <Link to={href(n)} onClick={onNavigate} className="shrink-0">
                  <Avatar src={n.profile_photo} alt={n.username} className="h-10 w-10" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={href(n)} onClick={onNavigate} className="block text-sm leading-snug">
                    <Sentence n={n} />
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--color-subtitle)]">
                    {String(n.created_at).replace(/^•\s*/, "")}
                  </p>

                  {pending && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => respond(n, "accept")}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--button-color-bg)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => respond(n, "decline")}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-[var(--button-hover-bg-color)]"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {accepted && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-subtitle)]">
                      <Check className="h-3.5 w-3.5" /> You're friends
                    </p>
                  )}
                </div>
                {fresh && (
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--button-color-bg)]"
                    aria-label="Unread"
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

NotifLeftBar.displayName = "NotifLeftBar";

export default NotifLeftBar;
