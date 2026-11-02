import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { messagesApi } from "@/redux/services/messages";
import { useStoredUser } from "@/utils/auth";

// The conversation currently open on screen (its new messages aren't "unread").
let activeConversationId = null;
export const setActiveConversation = (id) => {
  activeConversationId = id;
};
export const getActiveConversation = () => activeConversationId;

/** Applies real-time chat events from the WebSocket to the cached data, so
 *  the inbox, open thread and unread badge update without refetching. */
const ChatRealtime = () => {
  const dispatch = useDispatch();
  const me = useStoredUser();
  const myId = me?.user?.account_id;

  useEffect(() => {
    if (!myId) return;
    const update = messagesApi.util.updateQueryData;

    const onEvent = (e) => {
      const data = e.detail;
      switch (data?.type) {
        case "chat_message": {
          const m = data.message;
          const mine = m.sender_id === myId;
          const viewing = activeConversationId === m.conversation_id;
          dispatch(
            update("getMessages", m.conversation_id, (draft) => {
              if (draft && !draft.results.some((x) => x.id === m.id)) {
                draft.results.push(m);
              }
            })
          );
          let known = false;
          dispatch(
            update("getConversations", undefined, (draft) => {
              const i = draft.findIndex((c) => c.id === m.conversation_id);
              if (i === -1) return;
              known = true;
              const c = draft[i];
              c.last_message = m;
              c.updated_at = m.created_at;
              if (!mine && !viewing) c.unread += 1;
              draft.splice(i, 1);
              draft.unshift(c);
            })
          );
          if (!known) dispatch(messagesApi.util.invalidateTags(["Inbox"]));
          if (!mine && !viewing) dispatch(messagesApi.util.invalidateTags(["Unread"]));
          break;
        }
        case "chat_message_updated": {
          const m = data.message;
          dispatch(
            update("getMessages", m.conversation_id, (draft) => {
              const x = draft?.results.find((y) => y.id === m.id);
              if (x) Object.assign(x, m);
            })
          );
          dispatch(
            update("getConversations", undefined, (draft) => {
              const c = draft.find((y) => y.id === m.conversation_id);
              if (c?.last_message?.id === m.id) c.last_message = m;
            })
          );
          break;
        }
        case "chat_read": {
          const apply = (c) => {
            if (c) c.member_reads[String(data.account_id)] = data.read_at;
          };
          dispatch(update("getConversation", data.conversation_id, (d) => apply(d)));
          dispatch(
            update("getConversations", undefined, (draft) =>
              apply(draft.find((c) => c.id === data.conversation_id))
            )
          );
          break;
        }
        case "chat_conversation":
          dispatch(
            messagesApi.util.invalidateTags([
              "Inbox",
              { type: "Conversation", id: data.conversation_id },
            ])
          );
          break;
      }
    };

    window.addEventListener("glow:ws", onEvent);
    return () => window.removeEventListener("glow:ws", onEvent);
  }, [dispatch, myId]);

  return null;
};

export default ChatRealtime;
