// src/contexts/WebSocketContext.tsx
import { createContext, useContext, useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useDispatch, useSelector } from "react-redux";
import { accounts } from "@/redux/services/accounts/accounts";
import { API_HOST } from "./constants";

//Websocket Algorithm
//Note: useWebSocket is a context from WebSocketContext.
//1. I created a global websocket for all real time connections on the platform
//2. The globalSocket is called at the App.tsx
//3. To use socket connections on different pages just call useWebSocket
//4. All triggers are on the realtime app on the backend project, you can modify the events there
//5. PS. Hope you understand sockets, coz now i do more ... Have fun! -> Commented on June 14, 2025
//
// Security: the socket is authenticated with a short-lived ticket from
// /api/accounts/wsTicket/. The server takes the user's identity from that
// ticket and ignores any user_id sent in messages.

const WebSocketContext = createContext<RefObject<WebSocket | null> | null>(
  null
);

// Falls back to the API host (http -> ws) when VITE_WS_HOST isn't set.
const WS_HOST =
  import.meta.env.VITE_WS_HOST || (API_HOST || "").replace(/^http/, "ws");

const MAX_RETRY_DELAY = 30000;

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const user = useSelector((state: any) => state.auth.user);
  const dispatch = useDispatch<any>();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    if (!user) return;

    let stopped = false; // set on logout/unmount so we don't reconnect
    let attempts = 0;

    const scheduleReconnect = () => {
      if (stopped) return;
      const delay = Math.min(3000 * 2 ** attempts, MAX_RETRY_DELAY);
      attempts += 1;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    const connect = async () => {
      if (stopped) return;

      let ticket: string;
      try {
        const res = await dispatch(
          accounts.endpoints.getWsTicket.initiate(undefined)
        ).unwrap();
        ticket = res.ticket;
      } catch {
        // Not signed in (or server unreachable): try again later.
        scheduleReconnect();
        return;
      }
      if (stopped) return;

      const socket = new WebSocket(
        `${WS_HOST}/ws/global/?ticket=${encodeURIComponent(ticket)}`
      );
      socketRef.current = socket;

      socket.onopen = () => {
        attempts = 0;
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        window.dispatchEvent(new CustomEvent("glow:ws", { detail: data }));
        if (data.type === "user_logged_in") {
          console.log(`${data.username} just logged in`);
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        scheduleReconnect();
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [user, dispatch]);

  return (
    <WebSocketContext.Provider value={socketRef}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  return useContext(WebSocketContext);
};
