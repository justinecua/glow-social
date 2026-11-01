import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Gift, Loader2, UserPlus, UsersRound } from "lucide-react";
import InviteDialog from "@/features/growth/InviteDialog";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useGetMeQuery } from "@/redux/services/auth/auth";
import { useGetMyFriendsQuery } from "@/redux/services/discover";
import { useStoredUser } from "@/utils/auth";
import { useWebSocket } from "@/utils/WebSocketContext";
import PageHeader, { EmptyState } from "../components/PageHeader";
import PersonRow from "../components/PersonRow";

type Tab = "friends" | "incoming" | "outgoing";
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
  const { isLoading: checkingAuth } = useGetMeQuery(undefined);
  const socketRef = useWebSocket();
  const [tab, setTab] = useState<Tab>("friends");
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [inviteOpen, setInviteOpen] = useState(false);

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

  const list = { friends, incoming, outgoing }[tab];

  return (
    <AppShell>
      <div className="w-full max-w-xl">
        <PageHeader title="Friends">
          <Button
            onClick={() => setInviteOpen(true)}
            className="mt-4 cursor-pointer bg-[var(--button-color-bg)] text-white hover:opacity-90"
          >
            <Gift /> Invite friends to Glow
          </Button>
        </PageHeader>
        {storedUser?.user?.username && (
          <InviteDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            username={storedUser.user.username}
          />
        )}

        <div className="flex gap-6 border-b">
          {tabBtn("friends", "Friends", friends.length)}
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
                tab === "friends"
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
                    tab === "friends"
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
                    ) : (
                      actionBtn(
                        "Unfriend",
                        () => {
                          if (window.confirm(`Remove @${p.username} from your friends?`))
                            send("unfriend", p.id);
                        },
                        p.id
                      )
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
