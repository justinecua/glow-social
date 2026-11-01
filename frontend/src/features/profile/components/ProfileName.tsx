import AutomatedBadge from "@/components/ui/custom/AutomatedBadge";
import { useRef, useState } from "react";
import { useStoredUser } from "@/utils/auth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  UserPlus,
  UserRoundCheck,
  UserRoundPlus,
  UserRoundX,
} from "lucide-react";
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
  const [editOpen, setEditOpen] = useState(false);
  const navigate = useNavigate();
  const [startConversation, { isLoading: opening }] = useStartConversationMutation();
  const cap = (v?: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");
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
      })
    );
  };

  const cancelFriendRequest = () => {
    setCanceling(true);
    socketRef.current.send(
      JSON.stringify({
        type: "cancel_friend_request",
        friend_id: profile_id,
        user_id: user?.user?.account_id,
      })
    );
  };

  const acceptFriend = () => {
    setAccepting(true);
    socketRef.current.send(
      JSON.stringify({
        type: "accept_friend_result",
        friend_id: profile_id,
        user_id: user?.user?.account_id,
      })
    );
  };

  const unfriend = () => {
    setUnfriend(true);
    socketRef.current.send(
      JSON.stringify({
        type: "unfriend",
        friend_id: profile_id,
        user_id: user?.user?.account_id,
      })
    );
  };

  const isNotAuthenticated = () => {
    return (
      <div className="flex justify-between pr-5">
        <div className="ml-32 sm:ml-[10.5rem] lg:ml-[12rem] md:ml-[10.5rem] -mt-2">
          <h3 className="font-bold text-balance text-xl sm:text-2xl md:text-2xl lg:text-2xl">
            {displayName}
          </h3>
          <p className="text-xs sm:text-sm md:text-base text-[var(--color-subtitle)]">
            @{item?.username}
          </p>
        </div>
      </div>
    );
  };

  const isAuthenticated = () => {
    return (
      <>
        <div className="flex justify-between pr-5">
          <div className="ml-32 sm:ml-[10.5rem] lg:ml-[12rem] md:ml-[10.5rem] -mt-2">
            <h3 className="font-bold text-balance text-xl sm:text-2xl md:text-2xl lg:text-2xl">
              {displayName}
            </h3>
            <p className="flex items-center gap-2 text-xs sm:text-sm md:text-base text-[var(--color-subtitle)]">
              @{item?.username}
              {item?.is_bot && <AutomatedBadge />}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
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
                  className="cursor-pointer flex items-center gap-2"
                >
                  Send kudos
                </Button>
                <SendGlowDialog
                  open={glowOpen}
                  onOpenChange={setGlowOpen}
                  recipient={{ id: Number(id), username: item?.username, firstname: item?.firstname }}
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
                        const conv = await startConversation({ member_ids: [Number(id)] }).unwrap();
                        navigate(`/messages/${conv.id}`);
                      } catch (err: any) {
                        toast.error(err?.data?.detail || "Couldn't open the chat.");
                      }
                    }}
                    disabled={opening}
                    className="cursor-pointer flex items-center gap-2 bg-[var(--button-color-bg)] text-white hover:opacity-90"
                  >
                    {opening ? <Loader2 className="animate-spin w-4 h-4" /> : <MessageCircle />}
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
        </div>
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
