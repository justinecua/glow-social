import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeft,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  UserPlus,
  LogOut,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { useDispatch } from "react-redux";
import {
  messagesApi,
  useAddMembersMutation,
  useDeleteMessageMutation,
  useEditMessageMutation,
  useGetConversationQuery,
  useGetMessagesQuery,
  useLazyGetOlderMessagesQuery,
  useLeaveConversationMutation,
  useMarkReadMutation,
  useRenameGroupMutation,
  useSendMessageMutation,
} from "@/redux/services/messages";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/features/discover/components/PersonRow";
import { useWebSocket } from "@/utils/WebSocketContext";
import { setActiveConversation } from "./ChatRealtime";
import { ChatAvatar, clockTime, dayLabel, otherMembers, personName } from "./chatUtils";
import PickFriendsDialog from "./PickFriendsDialog";
import ChatDetails from "./ChatDetails";

const GROUP_GAP_MS = 5 * 60 * 1000; // bubbles closer than this stack together
const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-[var(--button-hover-bg-color)]";

const ChatThread = ({ conversationId, myId }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const socketRef = useWebSocket();
  const { data: conv, isError } = useGetConversationQuery(conversationId);
  const { data: page, isLoading } = useGetMessagesQuery(conversationId);
  const [loadOlder, { isFetching: loadingOlder }] = useLazyGetOlderMessagesQuery();
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [markRead] = useMarkReadMutation();
  const [editMessage] = useEditMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const [renameGroup] = useRenameGroupMutation();
  const [addMembers, { isLoading: adding }] = useAddMembersMutation();
  const [leaveConversation] = useLeaveConversationMutation();

  const [older, setOlder] = useState([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [typing, setTyping] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(() => {
    try {
      return localStorage.getItem("glow_chat_details") !== "closed";
    } catch {
      return true;
    }
  });
  const toggleDetails = (open) => {
    setDetailsOpen(open);
    try {
      localStorage.setItem("glow_chat_details", open ? "open" : "closed");
    } catch {
      /* ignore */
    }
  };

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);
  const lastTypingSent = useRef(0);
  const prevScrollHeight = useRef(null);

  // Reset per conversation; mark it as the one on screen.
  useEffect(() => {
    setOlder([]);
    setHasMoreOlder(true);
    setDraft("");
    setEditingId(null);
    setTyping({});
    stickToBottom.current = true;
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId]);

  const messages = useMemo(() => {
    const seen = new Set();
    return [...older, ...(page?.results ?? [])].filter((m) =>
      seen.has(m.id) ? false : (seen.add(m.id), true)
    );
  }, [older, page]);

  // Read receipts: mark read when opened and whenever new messages arrive here.
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!lastId) return;
    markRead(conversationId);
    dispatch(
      messagesApi.util.updateQueryData("getConversations", undefined, (d) => {
        const c = d.find((x) => x.id === conversationId);
        if (c) c.unread = 0;
      })
    );
  }, [conversationId, lastId, markRead, dispatch]);

  // Keep scrolled to the newest message (unless reading history),
  // and keep position stable when older messages are prepended.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevScrollHeight.current != null) {
      el.scrollTop = el.scrollHeight - prevScrollHeight.current;
      prevScrollHeight.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, typing]);

  const onScroll = async () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && hasMoreOlder && !loadingOlder && messages.length) {
      const before = messages[0].id;
      const res = await loadOlder({ conversation_id: conversationId, before })
        .unwrap()
        .catch(() => null);
      if (!res) return;
      prevScrollHeight.current = el.scrollHeight;
      setOlder((o) => [...res.results, ...o]);
      setHasMoreOlder(res.has_more);
    }
  };
  useEffect(() => {
    if (page && !page.has_more) setHasMoreOlder(false);
  }, [page]);

  // Typing indicator from other members (clears after 3.5s of silence).
  useEffect(() => {
    const onEvent = (e) => {
      const d = e.detail;
      if (d?.type === "chat_typing" && d.conversation_id === conversationId) {
        setTyping((t) => ({ ...t, [d.account_id]: Date.now() }));
      }
      if (d?.type === "chat_message" && d.message.conversation_id === conversationId) {
        setTyping((t) => {
          const n = { ...t };
          delete n[d.message.sender_id];
          return n;
        });
      }
    };
    window.addEventListener("glow:ws", onEvent);
    const timer = setInterval(() => {
      setTyping((t) => {
        const now = Date.now();
        const n = Object.fromEntries(Object.entries(t).filter(([, ts]) => now - ts < 3500));
        return Object.keys(n).length === Object.keys(t).length ? t : n;
      });
    }, 1000);
    return () => {
      window.removeEventListener("glow:ws", onEvent);
      clearInterval(timer);
    };
  }, [conversationId]);

  const signalTyping = useCallback(() => {
    const now = Date.now();
    const socket = socketRef?.current;
    if (now - lastTypingSent.current < 2000 || socket?.readyState !== WebSocket.OPEN) return;
    lastTypingSent.current = now;
    socket.send(JSON.stringify({ type: "typing", conversation_id: conversationId }));
  }, [socketRef, conversationId]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    stickToBottom.current = true;
    try {
      const m = await sendMessage({ conversation_id: conversationId, body }).unwrap();
      setDraft("");
      // Usually arrives over the WebSocket too; add it now in case it's slow.
      dispatch(
        messagesApi.util.updateQueryData("getMessages", conversationId, (d) => {
          if (d && !d.results.some((x) => x.id === m.id)) d.results.push(m);
        })
      );
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't send your message.");
    }
  };

  const saveEdit = async (m) => {
    const body = editText.trim();
    if (!body || body === m.body) return setEditingId(null);
    try {
      const updated = await editMessage({ message_id: m.id, body }).unwrap();
      patchMessage(updated);
      setEditingId(null);
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't save your edit.");
    }
  };

  const remove = async (m) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      patchMessage(await deleteMessage(m.id).unwrap());
    } catch {
      toast.error("Couldn't delete the message.");
    }
  };

  const patchMessage = (m) => {
    dispatch(
      messagesApi.util.updateQueryData("getMessages", conversationId, (d) => {
        const x = d?.results.find((y) => y.id === m.id);
        if (x) Object.assign(x, m);
      })
    );
    setOlder((o) => o.map((x) => (x.id === m.id ? m : x)));
  };

  const renameGroupPrompt = () => {
    if (!conv) return;
    const t = window.prompt("Group name", conv.title);
    if (t !== null) renameGroup({ conversation_id: conv.id, title: t });
  };
  const leaveGroup = async () => {
    if (!conv || !window.confirm("Leave this group?")) return;
    await leaveConversation(conv.id);
    navigate("/messages");
  };

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <p className="font-semibold">This chat isn't available</p>
        <Link to="/messages" className="mt-2 text-sm text-[var(--color-subtitle)] hover:underline">
          Back to messages
        </Link>
      </div>
    );
  }

  const others = conv ? otherMembers(conv, myId) : [];
  const byId = new Map((conv?.members ?? []).map((m) => [m.id, m]));
  const typingNames = Object.keys(typing)
    .map((id) => personName(byId.get(Number(id))).split(" ")[0])
    .filter(Boolean);

  // "Seen" under my latest message
  const myLast = [...messages].reverse().find((m) => m.sender_id === myId && !m.is_deleted);
  const seenBy =
    myLast && conv
      ? others.filter((o) => {
          const r = conv.member_reads[String(o.id)];
          return r && new Date(r) >= new Date(myLast.created_at);
        })
      : [];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-3 py-3">
          <button
            type="button"
            onClick={() => navigate("/messages")}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--button-hover-bg-color)] md:hidden"
            aria-label="Back to messages"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {conv ? (
            <>
              {conv.is_group ? (
                <ChatAvatar conversation={conv} myId={myId} size="h-10 w-10" />
              ) : (
                <Link to={`/profile/${others[0]?.id}`}>
                  <ChatAvatar conversation={conv} myId={myId} size="h-10 w-10" />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{conv.name}</p>
                <p className="truncate text-xs text-[var(--color-subtitle)]">
                  {conv.is_group
                    ? `${conv.members.length} members`
                    : `@${others[0]?.username ?? ""}`}
                </p>
              </div>
              {conv.is_group && (
                <DropdownMenu.Root modal={false}>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label="Group options"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--button-hover-bg-color)]"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    className="z-[300] min-w-[170px] rounded-lg border bg-[var(--home-card)] p-1 shadow-lg"
                  >
                    <DropdownMenu.Item className={menuItem} onSelect={renameGroupPrompt}>
                      <Type className="h-4 w-4" /> Rename group
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={menuItem} onSelect={() => setAddOpen(true)}>
                      <UserPlus className="h-4 w-4" /> Add people
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={`${menuItem} text-red-500`} onSelect={leaveGroup}>
                      <LogOut className="h-4 w-4" /> Leave group
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              )}
            </>
          ) : (
            <>
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </>
          )}
          {conv && (
            <button
              type="button"
              onClick={() => toggleDetails(!detailsOpen)}
              aria-pressed={detailsOpen}
              aria-label={detailsOpen ? "Hide details" : "Show details"}
              title={detailsOpen ? "Hide details" : "Show details"}
              className={`hidden h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--button-hover-bg-color)] lg:flex ${
                detailsOpen
                  ? "text-[var(--button-color-bg)] dark:text-white"
                  : "text-[var(--color-subtitle)]"
              }`}
            >
              <Info className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-4 custom-scrollbar"
        >
          {loadingOlder && <Loader2 className="mx-auto mb-3 h-4 w-4 animate-spin" />}
          {isLoading ? (
            <div className="space-y-3" aria-hidden>
              {[60, 40, 70, 30].map((w, i) => (
                <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                  <Skeleton className="h-9 rounded-2xl" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 && conv ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ChatAvatar conversation={conv} myId={myId} size="h-16 w-16" />
              <p className="mt-3 font-semibold">{conv.name}</p>
              <p className="text-sm text-[var(--color-subtitle)]">Say hi 👋</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const mine = m.sender_id === myId;
              const newDay =
                !prev ||
                new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const joinsPrev =
                !newDay &&
                prev?.sender_id === m.sender_id &&
                new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() <
                  GROUP_GAP_MS;
              const joinsNext =
                next &&
                next.sender_id === m.sender_id &&
                new Date(next.created_at).toDateString() ===
                  new Date(m.created_at).toDateString() &&
                new Date(next.created_at).getTime() - new Date(m.created_at).getTime() <
                  GROUP_GAP_MS;
              const sender = byId.get(m.sender_id);

              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <p className="my-4 text-center text-[11px] font-medium text-[var(--color-subtitle)]">
                      {dayLabel(m.created_at)}
                    </p>
                  )}
                  <div
                    className={`group/msg flex items-end gap-2 ${mine ? "justify-end" : ""} ${joinsPrev ? "mt-0.5" : "mt-3"}`}
                  >
                    {/* Their photo (left), once per run of consecutive messages */}
                    {!mine && (
                      <span className="mb-5 w-7 shrink-0">
                        {!joinsNext && (
                          <Link to={`/profile/${m.sender_id}`} title={personName(sender)}>
                            <Avatar
                              src={sender?.profile_photo}
                              alt={sender?.username ?? ""}
                              className="h-7 w-7"
                            />
                          </Link>
                        )}
                      </span>
                    )}
                    {mine && !m.is_deleted && editingId !== m.id && (
                      <DropdownMenu.Root modal={false}>
                        <DropdownMenu.Trigger asChild>
                          <button
                            type="button"
                            aria-label="Message options"
                            className="mb-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-subtitle)] opacity-100 hover:bg-[var(--photo-bg)] data-[state=open]:opacity-100 md:opacity-0 md:group-hover/msg:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content
                          align="end"
                          sideOffset={4}
                          className="z-[300] min-w-[130px] rounded-lg border bg-[var(--home-card)] p-1 shadow-lg"
                        >
                          <DropdownMenu.Item
                            className={menuItem}
                            onSelect={() => {
                              setEditingId(m.id);
                              setEditText(m.body);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            className={`${menuItem} text-red-500`}
                            onSelect={() => remove(m)}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    )}
                    <div
                      className={`flex max-w-[min(75%,40rem)] flex-col ${mine ? "items-end" : "items-start"}`}
                    >
                      {!mine && conv?.is_group && !joinsPrev && (
                        <span className="mb-0.5 ml-3 text-[11px] text-[var(--color-subtitle)]">
                          {personName(sender).split(" ")[0]}
                        </span>
                      )}
                      {editingId === m.id ? (
                        <div className="w-72 max-w-full rounded-2xl border bg-[var(--photo-bg)] p-2">
                          <textarea
                            autoFocus
                            value={editText}
                            maxLength={2000}
                            rows={2}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                saveEdit(m);
                              }
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            aria-label="Edit message"
                            className="w-full resize-none bg-transparent text-sm outline-none [overflow-wrap:anywhere]"
                          />
                          <div className="flex justify-end gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="cursor-pointer rounded px-2 py-1 hover:bg-[var(--button-hover-bg-color)]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEdit(m)}
                              className="cursor-pointer rounded bg-[var(--button-color-bg)] px-2.5 py-1 font-semibold text-white"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          title={clockTime(m.created_at)}
                          className={`whitespace-pre-wrap px-3.5 py-2 text-sm [overflow-wrap:anywhere] ${
                            m.is_deleted
                              ? "rounded-2xl border italic text-[var(--color-subtitle)]"
                              : mine
                                ? "rounded-2xl bg-[var(--button-color-bg)] text-white"
                                : "rounded-2xl bg-[var(--photo-bg)]"
                          } ${mine ? (joinsPrev ? "rounded-tr-md" : "") + (joinsNext ? " rounded-br-md" : "") : (joinsPrev ? "rounded-tl-md" : "") + (joinsNext ? " rounded-bl-md" : "")}`}
                        >
                          {m.is_deleted ? "Message deleted" : m.body}
                        </div>
                      )}
                      {!joinsNext && editingId !== m.id && (
                        <span className="mt-1 px-1 text-[10px] text-[var(--color-subtitle)]">
                          {clockTime(m.created_at)}
                          {m.edited && " · edited"}
                          {myLast?.id === m.id &&
                            seenBy.length > 0 &&
                            (conv?.is_group ? ` · Seen by ${seenBy.length}` : " · Seen")}
                        </span>
                      )}
                    </div>
                    {/* My photo (right), once per run */}
                    {mine && (
                      <span className="mb-5 w-7 shrink-0">
                        {!joinsNext && (
                          <Avatar src={sender?.profile_photo} alt="You" className="h-7 w-7" />
                        )}
                      </span>
                    )}
                  </div>
                </Fragment>
              );
            })
          )}
          {typingNames.length > 0 && (
            <p
              className="mt-3 flex items-center gap-2 text-xs text-[var(--color-subtitle)]"
              aria-live="polite"
            >
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
              </span>
              {conv?.is_group
                ? `${typingNames.join(", ")} ${typingNames.length > 1 ? "are" : "is"} typing`
                : "typing"}
            </p>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 border-t p-3"
        >
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            maxLength={2000}
            onChange={(e) => {
              setDraft(e.target.value);
              signalTyping();
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message"
            aria-label="Message"
            className="max-h-36 min-h-10 flex-1 resize-none rounded-2xl border bg-transparent px-4 py-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [overflow-wrap:anywhere] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--button-color-bg)] text-white transition-opacity disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        {conv?.is_group && (
          <PickFriendsDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            title="Add people"
            confirmLabel={(n) => (n ? `Add ${n}` : "Add")}
            exclude={conv.members.map((m) => m.id)}
            busy={adding}
            onConfirm={async (ids) => {
              try {
                await addMembers({ conversation_id: conv.id, member_ids: ids }).unwrap();
                setAddOpen(false);
              } catch (err) {
                toast.error(err?.data?.detail || "Couldn't add them.");
              }
            }}
          />
        )}
      </div>

      {conv && detailsOpen && (
        <ChatDetails
          conv={conv}
          myId={myId}
          onClose={() => toggleDetails(false)}
          onRename={renameGroupPrompt}
          onAddPeople={() => setAddOpen(true)}
          onLeave={leaveGroup}
        />
      )}
    </div>
  );
};

export default ChatThread;
