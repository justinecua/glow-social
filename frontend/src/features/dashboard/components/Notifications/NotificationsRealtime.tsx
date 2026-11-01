import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { receivedApi } from "@/redux/services/notifications/notifications";

// Server events that mean "your notifications changed".
const EVENTS = new Set([
  "notification",
  "add_friend_result",
  "accept_friend_result",
  "cancel_friend_request",
  "unfriend",
  "refresh_friend_status",
]);

/** Keeps the notification badge and panel live: refetch on relevant events. */
const NotificationsRealtime = () => {
  const dispatch = useDispatch<any>();
  useEffect(() => {
    const onEvent = (e: Event) => {
      const type = (e as CustomEvent).detail?.type;
      if (EVENTS.has(type)) dispatch(receivedApi.util.invalidateTags(["Notifications"]));
    };
    window.addEventListener("glow:ws", onEvent);
    return () => window.removeEventListener("glow:ws", onEvent);
  }, [dispatch]);
  return null;
};

export default NotificationsRealtime;
