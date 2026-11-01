import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Star, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useGetMyFriendsQuery, useSetCloseFriendMutation } from "@/redux/services/discover";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import { useWebSocket } from "@/utils/WebSocketContext";
import PageHeader, { EmptyState } from "../components/PageHeader";
import PersonRow from "../components/PersonRow";

type Tab = "friends" | "close" | "incoming" | "outgoing";
type FriendAction =
  | "accept_friend_result"
  | "cancel_friend_request"
  | "unfriend";

const since = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "";

const FriendsPage = () => {
  const storedUser = useStoredUser() as any;
  const checkingAuth = useAuthChecking();
  const socketRef = useWebSocket();
  const [tab, setTab] = useState<Tab>("friends");
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [setCloseFriend] = useSetCloseFriendMutation();

  const { data, isLoading, refetch } = useGetMyFriendsQuery(undefined, {
    skip: !storedUser,
    refetchOnMountOrArgChange: true,
  });

  // Friend actions go over the WebSocket; refresh when the server confirms.
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (
          [
            "refresh_friend_status",
            "accept_friend_result",
            "cancel_friend_request",
            "unfriend",
          ].includes(msg.type)
        ) {
          setBusy({});
          refetch();
        }
      } catch {
        /* ignore non-JSON */
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [socketRef, socketRef?.current, refetch]);

  if (!storedUser && checkingAuth) {
    return (
      <AppShell>
        <Loader2 className="mt-20 animate-spin" />
      </AppShell>
    );
  }
  if (!storedUser) return <Navigate to="/login" replace />;

  const send = (type: FriendAction, friendId: number) => {
    const socket = socketRef?.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      toast.error("Connecting… please try again in a second.");
      return;
    }
    setBusy((b) => ({ ...b, [friendId]: true }));
    socket.send(JSON.stringify({ type, friend_id: friendId }));
  };

  const friends = data?.friends ?? [];
  const closeFriends = friends.filter((f: any) => f.is_close);
  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];

  const tabBtn = (id: Tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`relative cursor-pointer border-b-2 px-1 pb-2 text-sm transition-colors ${
        tab === id
          ? "border-[var(--button-color-bg)] font-semibold text-[var(--title-color)]"
          : "border-transparent text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
      }`}
    >
      {label} <span className="opacity-60">{count}</span>
      {id === "incoming" && count > 0 && (
        <span className="absolute -right-2 top-0 h-2 w-2 rounded-full bg-red-500" />
      )}
    </button>
  );

  const actionBtn = (
    label: string,
    onClick: () => void,
    id: number,
    primary = false
  ) => (
    <Button
      size="sm"
      variant={primary ? "default" : "outline"}
      disabled={busy[id]}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`cursor-pointer ${
        primary ? "bg-[var(--button-color-bg)] text-white hover:opacity-90" : ""
      }`}
    >
      {busy[id] ? <Loader2 className="animate-spin" /> : label}
    </Button>
  );

  const list = { friends, close: closeFriends, incoming, outgoing }[tab];

  const starBtn = (p: any) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        setCloseFriend({ account_id: p.id, close: !p.is_close })
          .unwrap()
          .then(() =>
            toast.success(
              p.is_close
                ? `Removed @${p.username} from Close friends`
                : `Added @${p.username} to Close friends`
            )
          )
          .catch(() => toast.error("Couldn't update Close friends."));
      }}
      aria-pressed={!!p.is_close}
      aria-label={p.is_close ? "Remove from Close friends" : "Add to Close friends"}
      title={p.is_close ? "Remove from Close friends" : "Add to Close friends"}
      className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--button-hover-bg-color)] ${
        p.is_close ? "text-[var(--button-color-bg)] dark:text-white" : "text-[var(--color-subtitle)]"
      }`}
    >
      <Star className="h-4 w-4" fill={p.is_close ? "currentColor" : "none"} />
    </button>
  );

  return (
    <AppShell>
      <div className="w-full max-w-xl">
        <PageHeader title="Friends" />

        <div className="flex gap-6 border-b">
          {tabBtn("friends", "Friends", friends.length)}
          {tabBtn("close", "Close friends", closeFriends.length)}
          {tabBtn("incoming", "Requests", incoming.length)}
          {tabBtn("outgoing", "Sent", outgoing.length)}
        </div>

        <div className="mt-3">
          {isLoading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={
                tab === "friends" ? (
                  <UsersRound className="h-5 w-5" />
                ) : (
                  <UserPlus className="h-5 w-5" />
                )
              }
              title={
                tab === "close"
                  ? "No close friends yet"
                  : tab === "friends"
                  ? "No friends yet"
                  : tab === "incoming"
                  ? "No friend requests"
                  : "No pending requests"
              }
            />
          ) : (
            <div className="rounded-xl bg-[var(--home-card)] p-1">
              {list.map((p: any) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  meta={
                    tab === "friends" || tab === "close"
                      ? `Friends since ${since(p.date_became_friends || p.date_friend_request)}`
                      : `Sent ${since(p.date_friend_request)}`
                  }
                  action={
                    tab === "incoming" ? (
                      <div className="flex gap-2">
                        {actionBtn("Accept", () => send("accept_friend_result", p.id), p.id, true)}
                        {actionBtn("Decline", () => send("cancel_friend_request", p.id), p.id)}
                      </div>
                    ) : tab === "outgoing" ? (
                      actionBtn("Cancel", () => send("cancel_friend_request", p.id), p.id)
                    ) : tab === "close" ? (
                      starBtn(p)
                    ) : (
                      <div className="flex items-center gap-1">
                      {starBtn(p)}
                      {actionBtn(
                        "Unfriend",
                        () => {
                          if (window.confirm(`Remove @${p.username} from your friends?`))
                            send("unfriend", p.id);
                        },
                        p.id
                      )}
                      </div>
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
};

export default FriendsPage;
