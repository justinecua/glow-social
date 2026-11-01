import { forwardRef, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useWebSocket } from "@/utils/WebSocketContext";
import {
  useGetNotificationsByUserQuery,
  useGetCountNotificationsByUserQuery,
} from "@/redux/services/notifications/notifications";
import { useStoredUser } from "@/utils/auth";
import { Link } from "react-router-dom";
import NotificationsCount from "./NotifCount";
import { Avatar } from "@/features/discover/components/PersonRow";

const NotifLeftBar = forwardRef((props, ref) => {
  const user = useStoredUser();
  const socketRef = useWebSocket();
  const { isLoading, data: initialNotifications } =
    useGetNotificationsByUserQuery({
      account_id: user?.user?.account_id,
    });

  const [notifList, setNotifList] = useState([]);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!isLoading && initialNotifications) {
      setNotifList(initialNotifications);
    }
  }, [isLoading, initialNotifications]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "notification") {
          setNotifList(data.notifications);
          setNotifCount(data.count);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socketRef]);

  const renderNotif = () => {
    if (isLoading || !notifList) {
      return (
        <div className="text-center text-gray-500">
          Loading notifications...
        </div>
      );
    }

    return notifList.map((notif) => {
      const labels: Record<string, string> = {
        friend_request: "Friend request",
        glow_note: "Glow",
        invite_joined: "Invite",
        comment: "Comment",
        glow: "Glow",
        share: "Share",
      };
      const NotifType = labels[notif?.notif_type] ?? "Notification";
      // A glow note links to your own Glow Wall; everything else to the sender.
      const href =
        notif?.notif_type === "glow_note"
          ? `/profile/${notif?.notif_to_id}?tab=glows`
          : `/profile/${notif?.notif_from_id}`;

      return (
        <Link to={href} key={notif.id}>
          <Card className="mt-4 p-0 bg-[var(--home-card)] border-0 shadow-none">
            <CardContent className="p-0 flex space-between w-full border-0">
              <div className="mr-4">
                <Avatar
                  src={notif?.profile_photo}
                  alt={notif?.username || "profile"}
                  className="h-10 w-10"
                />
              </div>
              <div>
                <div className="flex gap-1 ">
                  <p className="text-sm text-[var(--text-color-dateTime)]">
                    {NotifType}
                  </p>
                  <p className="text-sm text-[var(--text-color-dateTime)]">
                    {notif?.created_at}
                  </p>
                </div>
                <p className="text-sm">{notif.content}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      );
    });
  };

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "add_friend_result") {
          console.log("Friend result received:", data);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socketRef]);

  return (
    <div ref={ref} className="flex">
      <Card className="fixed top-0 left-83 mt-3 mr-4 w-[322px] h-[97%] z-50 bg-[var(--home-card)] shadow-lg">
        <CardContent>
          <div className="flex items-center">
            {" "}
            <h3 className="flex items-center  font-semibold text-md mr-3">
              Notifications
            </h3>
            <NotificationsCount />
          </div>

          {renderNotif()}
        </CardContent>
      </Card>
    </div>
  );
});

NotifLeftBar.displayName = "NotifLeftBar";

export default NotifLeftBar;
