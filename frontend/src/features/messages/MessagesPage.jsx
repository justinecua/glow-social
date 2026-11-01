import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import { useStartConversationMutation } from "@/redux/services/messages";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import ChatThread from "./ChatThread";
import ConversationList from "./ConversationList";
import PickFriendsDialog from "./PickFriendsDialog";

/** /messages (inbox) and /messages/:id (a chat). Two panes on desktop,
 *  one at a time on phones. */
const MessagesPage = () => {
  const { id } = useParams();
  const conversationId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const user = useStoredUser();
  const checking = useAuthChecking();
  const myId = user?.user?.account_id;
  const [newOpen, setNewOpen] = useState(false);
  const [startConversation, { isLoading: starting }] = useStartConversationMutation();

  if (!user && checking) {
    return (
      <AppShell showRight={false}>
        <Loader2 className="mt-20 animate-spin" />
      </AppShell>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AppShell showRight={false}>
      <div className="flex h-[calc(100dvh-5rem)] w-full overflow-hidden rounded-none bg-[var(--home-card)] md:my-4 md:h-[calc(100dvh-2rem)] md:rounded-xl md:border xl:h-[calc(100dvh-2rem)]">
        <aside
          className={`w-full min-h-0 border-r md:block md:w-80 md:shrink-0 lg:w-96 ${
            conversationId ? "hidden" : "block"
          }`}
        >
          <ConversationList
            myId={myId}
            activeId={conversationId}
            onNewChat={() => setNewOpen(true)}
          />
        </aside>

        <section className={`min-h-0 flex-1 ${conversationId ? "block" : "hidden md:block"}`}>
          {conversationId && myId ? (
            <ChatThread key={conversationId} conversationId={conversationId} myId={myId} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <span className="mb-3 rounded-full bg-[var(--photo-bg)] p-4 text-[var(--color-subtitle)]">
                <MessageCircle className="h-6 w-6" />
              </span>
              <p className="font-semibold">Your messages</p>
              <p className="mt-1 text-sm text-[var(--color-subtitle)]">
                Chat with friends, one-on-one or in groups.
              </p>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="mt-4 cursor-pointer rounded-lg bg-[var(--button-color-bg)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                New message
              </button>
            </div>
          )}
        </section>
      </div>

      <PickFriendsDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        title="New message"
        allowGroupName
        busy={starting}
        confirmLabel={(n) => (n > 1 ? `Create group (${n + 1})` : "Chat")}
        onConfirm={async (ids, groupName) => {
          try {
            const conv = await startConversation({ member_ids: ids, title: groupName }).unwrap();
            setNewOpen(false);
            navigate(`/messages/${conv.id}`);
          } catch (err) {
            toast.error(err?.data?.detail || "Couldn't start the chat.");
          }
        }}
      />
    </AppShell>
  );
};

export default MessagesPage;
