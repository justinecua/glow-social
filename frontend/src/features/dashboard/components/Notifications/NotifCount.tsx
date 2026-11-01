import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/utils/WebSocketContext";
import { useStoredUser } from "@/utils/auth";
import { useGetCountNotificationsByUserQuery } from "@/redux/services/notifications/notifications";

const NotificationsCount = () => {
  const user = useStoredUser();
  const socketRef = useWebSocket();

  const { data: initialCount } = useGetCountNotificationsByUserQuery({
    account_id: user?.user?.account_id,
  });

  const [notifCount, setNotifCount] = useState(0);
  const [notifList, setNotifList] = useState([]);

  useEffect(() => {
    if (initialCount !== undefined && notifCount === 0) {
      setNotifCount(initialCount);
    }
  }, [initialCount]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification") {
          setNotifCount(data.count);
          setNotifList(data.notifications);
        }
      } catch (err) {
        console.error("WebSocket error in NotificationsCount:", err);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socketRef]);

  if (!notifCount || notifCount === 0) return null;

  return (
    <Badge className="h-5 min-w-5 rounded-full px-1 bg-red-500 text-white">
      {notifCount}
    </Badge>
  );
};

export default NotificationsCount;
