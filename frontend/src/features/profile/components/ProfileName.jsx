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
import { MessageCircle, Pencil } from "lucide-react";
import EditProfileDialog from "./EditProfileDialog";
import { useStartConversationMutation } from "@/redux/services/messages";

const ProfileName = ({ item, id }) => {
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

  const {
    data: initialFriendRequest,
    isLoading,
    refetch,
  } = useCheckUserFriendRequestQuery({
    friend_id: id,
    accId: user?.user?.account_id,
  });

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

      if (data.type === "unfriend_result") {
        setUnfriend(false);
      }

      if (data.type === "refresh_friend_status") {
        refetch();
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socketRef, profile_id, user, refetch]);

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

  const nameBlock = (
    <div className="min-w-0">
      <h1 className="truncate text-xl font-bold leading-tight sm:text-2xl">
        {displayName}
      </h1>
      <p className="mt-0.5 flex items-center gap-2 text-sm text-[var(--color-subtitle)]">
        @{item?.username}
        {item?.is_bot && <AutomatedBadge />}
      </p>
    </div>
  );

  const isNotAuthenticated = () => {
    return <div className="px-4 pt-16 sm:px-6 sm:pt-[4.5rem]">{nameBlock}</div>;
  };

  const isAuthenticated = () => {
    return (
      <>
        <div className="flex min-h-14 flex-wrap items-start justify-end gap-2 px-4 pt-3 pl-32 sm:min-h-16 sm:px-6 sm:pl-40 [&_button]:h-9 [&_button]:rounded-full [&_button]:px-4">
          {isOwnProfile && (
            <>
              <Button
                variant="outline"
                onClick={() => setEditOpen(true)}
                className="cursor-pointer flex items-center gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit profile
              </Button>
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
        </div>
        <div className="px-4 pt-2 sm:px-6">{nameBlock}</div>
      </>
    );
  };

  const authenticated = () => {
    if (user) {
      return isAuthenticated();
    } else {
      return isNotAuthenticated();
    }
  };

  return authenticated();
};

export default ProfileName;
