import { useKudosSent } from "@/features/glows/useKudosSent";
import AutomatedBadge from "@/components/ui/custom/AutomatedBadge";
import { useState } from "react";
import { useStoredUser } from "@/utils/auth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, UserRoundPlus, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "@/utils/WebSocketContext";
import { useCheckUserFriendRequestQuery } from "@/redux/services/friends/friends";
import SendGlowDialog from "@/features/glows/SendGlowDialog";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Palette, Pencil } from "lucide-react";
import EditProfileDialog from "./EditProfileDialog";
import { useStartConversationMutation } from "@/redux/services/messages";

const ProfileName = ({ item, id, design, look, asVisitor = false, onDesign, designOpening = false }) => {
  const layout = design.header_layout === "centered" || design.header_layout === "no_cover" ? "center" : design.header_layout === "split" ? "split" : "classic";
  const nameEffect = design.name_effect === "none" ? "" : `pf-name-${design.name_effect}`;
  const user = useStoredUser();
  const profile_id = id;
  const socketRef = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [unfriending, setUnfriend] = useState(false);
  const [glowOpen, setGlowOpen] = useState(false);
  const kudosSent = useKudosSent(id);
  const [editOpen, setEditOpen] = useState(false);
  const navigate = useNavigate();
  const [startConversation, { isLoading: opening }] =
    useStartConversationMutation();
  const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");
  // Fall back to the username when someone hasn't set a name yet.
  const displayName =
    [cap(item?.firstname), cap(item?.lastname)].filter(Boolean).join(" ") ||
    item?.username;

  const skipFriendCheck = !id || !user?.user?.account_id || id == user?.user?.account_id; // signed out or own profile
  const {
    data: initialFriendRequest,
    isLoading,
    refetch,
  } = useCheckUserFriendRequestQuery(
    { friend_id: id, accId: user?.user?.account_id },
    { skip: skipFriendCheck },
  );

  const isOwnProfile = id == user?.user?.account_id;
  const isSender = user?.user?.account_id === initialFriendRequest?.user_id;
  const isReceiver = user?.user?.account_id === initialFriendRequest?.friend_id;

  const PendingRequestSender =
    initialFriendRequest?.status === "Pending" && isSender;
  const PendingRequestReceiver =
    initialFriendRequest?.status === "Pending" && isReceiver;

  const Friends = initialFriendRequest?.status === "Friends";

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleMessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "add_friend_result") {
        setLoading(false);
      }

      if (data.type === "cancel_friend_request") {
        setCanceling(false);
      }

      if (data.type === "accept_friend_result") {
        setAccepting(false);
        setUnfriend(false);
      }

      if (data.type === "unfriend") {
        setUnfriend(false);
      }

      if (data.type === "refresh_friend_status" && !skipFriendCheck) {
        refetch(); // throws if the query was skipped
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socketRef, profile_id, user, refetch, skipFriendCheck]);

  const addFriend = () => {
    setLoading(true);
    socketRef.current.send(
      JSON.stringify({
        type: "add_friend_result",
        friend_id: profile_id,
        user_id: user?.user?.account_id,
      }),
    );
  };

  const cancelFriendRequest = () => {
    setCanceling(true);
    socketRef.current.send(
      JSON.stringify({
        type: "cancel_friend_request",
        friend_id: profile_id,
        user_id: user?.user?.account_id,
      }),
    );
  };

  const acceptFriend = () => {
    setAccepting(true);
    socketRef.current.send(
      JSON.stringify({
        type: "accept_friend_result",
        friend_id: profile_id,
        user_id: user?.user?.account_id,
      }),
    );
  };

  const unfriend = () => {
    setUnfriend(true);
    socketRef.current.send(
      JSON.stringify({
        type: "unfriend",
        friend_id: profile_id,
        user_id: user?.user?.account_id,
      }),
    );
  };

  const mood = design.mood?.emoji || design.mood?.text ? design.mood : null;
  const nameBlock = (
    <div className="min-w-0">
      <h1
        className={`flex items-center gap-2 text-xl font-bold leading-tight sm:text-2xl ${
          layout === "center" ? "justify-center" : ""
        } ${look.serif ? "font-serif" : ""}`}
      >
        <span className={`truncate pb-[0.08em] ${nameEffect}`}>{displayName}</span>
        {design.name_badge && <span aria-hidden="true">{design.name_badge}</span>}
      </h1>
      <p
        className={`mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[var(--color-subtitle)] ${
          layout === "center" ? "justify-center" : ""
        }`}
      >
        @{item?.username}
        {item?.is_bot && <AutomatedBadge />}
        {mood && (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--button-color-bg)_12%,transparent)] px-2.5 py-0.5 text-xs font-medium text-[var(--title-color)]">
            {mood.emoji} {mood.text}
          </span>
        )}
      </p>
    </div>
  );

  const showOwnActions = isOwnProfile && !asVisitor;
  const actions = !user || (isOwnProfile && asVisitor) ? null : (
    <>
          {showOwnActions && (
            <>
              <Button
                variant="outline"
                onClick={() => setEditOpen(true)}
                className="cursor-pointer flex items-center gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
              {onDesign && (
                <Button
                  onClick={onDesign}
                  disabled={designOpening}
                  className="cursor-pointer flex items-center gap-2 bg-[var(--button-color-bg)] text-white hover:opacity-90"
                >
                  {designOpening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
                  {designOpening ? "Opening…" : "Design"}
                </Button>
              )}
              <EditProfileDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                item={item}
                profileId={id}
              />
            </>
          )}
          {!isOwnProfile && (
            <>
              <Button
                variant="outline"
                onClick={() => setGlowOpen(true)}
                disabled={kudosSent}
                title={
                  kudosSent
                    ? "You can send them kudos again tomorrow"
                    : undefined
                }
                className="cursor-pointer flex items-center gap-2"
              >
                {kudosSent ? "Kudos sent" : "Send kudos"}
              </Button>
              <SendGlowDialog
                open={glowOpen}
                onOpenChange={setGlowOpen}
                recipient={{
                  id: Number(id),
                  username: item?.username,
                  firstname: item?.firstname,
                  profile_photo: item?.profile_photo,
                }}
              />
            </>
          )}
          {!isLoading && !isOwnProfile && (
            <>
              {Friends ? (
                <>
                  <Button
                    onClick={async () => {
                      try {
                        const conv = await startConversation({
                          member_ids: [Number(id)],
                        }).unwrap();
                        navigate(`/messages/${conv.id}`);
                      } catch (err) {
                        toast.error(
                          err?.data?.detail || "Couldn't open the chat.",
                        );
                      }
                    }}
                    disabled={opening}
                    className="cursor-pointer flex items-center gap-2 bg-[var(--button-color-bg)] text-white hover:opacity-90"
                  >
                    {opening ? (
                      <Loader2 className="animate-spin w-4 h-4" />
                    ) : (
                      <MessageCircle />
                    )}
                    Message
                  </Button>
                  <Button
                    variant="outline"
                    onClick={unfriend}
                    disabled={unfriending}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    {unfriending ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" />
                        Unfriending...
                      </>
                    ) : (
                      <>
                        <UserRoundX />
                        Unfriend
                      </>
                    )}
                  </Button>
                </>
              ) : PendingRequestSender ? (
                <Button
                  onClick={cancelFriendRequest}
                  disabled={canceling}
                  className="bg-[var(--photo-bg)] text-[var(--button-text-color)] hover:bg-[var(--button-hover-bg-color)] cursor-pointer flex items-center gap-2"
                >
                  {canceling ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      Canceling...
                    </>
                  ) : (
                    <>
                      <UserRoundX />
                      Cancel Request
                    </>
                  )}
                </Button>
              ) : PendingRequestReceiver ? (
                <div className="flex gap-2">
                  <Button
                    onClick={acceptFriend}
                    disabled={accepting}
                    className="cursor-pointer bg-blue-500 text-white hover:bg-[var(--button-color-bg-hover)] cursor-pointer flex items-center gap-2 bg-[var(--button-color-bg)]"
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        <UserPlus />
                        Accept
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={cancelFriendRequest}
                    disabled={canceling}
                    className="bg-[var(--photo-bg)] text-[var(--button-text-color)] hover:bg-[var(--button-hover-bg-color)] cursor-pointer flex items-center gap-2"
                  >
                    {canceling ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <UserRoundX />
                        Remove
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={addFriend}
                  disabled={loading}
                  className="cursor-pointer bg-blue-500 text-white hover:bg-[var(--button-color-bg-hover)] cursor-pointer flex items-center gap-2 bg-[var(--button-color-bg)]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-4 h-4" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <UserRoundPlus />
                      Add Friend
                    </>
                  )}
                </Button>
              )}
            </>
          )}
    </>
  );


  const buttons = "[&_button]:h-9 [&_button]:rounded-full [&_button]:px-4";

  if (layout === "center") {
    return (
      <div className="flex flex-col items-center px-4 pt-[4.5rem] text-center sm:px-6 sm:pt-[5.5rem] md:pt-24">
        {nameBlock}
        {actions && <div className={`mt-3 flex flex-wrap justify-center gap-2 ${buttons}`}>{actions}</div>}
      </div>
    );
  }

  if (layout === "split") {
    return (
      <div className="flex min-h-16 flex-wrap items-start justify-between gap-3 px-4 pt-3 pl-36 sm:min-h-[4.5rem] sm:px-6 sm:pl-48 md:min-h-20 md:pl-52">
        {nameBlock}
        {actions && <div className={`flex flex-wrap gap-2 ${buttons}`}>{actions}</div>}
      </div>
    );
  }

  if (!actions) {
    return <div className="px-4 pt-[4.5rem] sm:px-6 sm:pt-[5.5rem] md:pt-24">{nameBlock}</div>;
  }

  return (
    <>
      <div className={`flex min-h-16 flex-wrap items-start justify-end gap-2 px-4 pt-3 pl-36 sm:min-h-[4.5rem] sm:px-6 sm:pl-48 md:min-h-20 md:pl-52 ${buttons}`}>
        {actions}
      </div>
      <div className="px-4 pt-2 sm:px-6">{nameBlock}</div>
    </>
  );
};

export default ProfileName;
