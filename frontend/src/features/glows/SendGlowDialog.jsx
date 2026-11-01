import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/features/discover/components/PersonRow";
import {
  useGetMyGlowStatusQuery,
  useSendGlowNoteMutation,
} from "@/redux/services/growth";

const MAX = 140;

/** Write someone a short kudos note. */
const SendGlowDialog = ({ open, onOpenChange, recipient }) => {
  const [message, setMessage] = useState("");
  const [sendGlow, { isLoading }] = useSendGlowNoteMutation();
  const { data: status } = useGetMyGlowStatusQuery(undefined, { skip: !open });

  useEffect(() => {
    if (!open) setMessage("");
  }, [open]);

  const name = recipient.firstname || `@${recipient.username}`;
  const remaining = status?.remaining_today ?? null;
  const outOfGlows = remaining === 0;
  const passingOn = status?.passes_available > 0;
  const canSend = !!message.trim() && !isLoading && !outOfGlows;
  const nearLimit = message.length > MAX - 20;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSend) return;
    try {
      const note = await sendGlow({
        recipient_id: Number(recipient.id),
        message: message.trim(),
      }).unwrap();
      toast.success(
        note.chain_length > 1
          ? `Passed on. That's ${note.chain_length} people in this chain.`
          : `Kudos sent to ${name}.`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't send your kudos. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden bg-[var(--home-card)] p-0 sm:max-w-md">
        <form onSubmit={submit}>
          {/* To: who */}
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <Avatar
              src={recipient.profile_photo}
              alt={recipient.username}
              className="h-10 w-10 shrink-0"
            />
            <div className="min-w-0 flex-1 leading-tight">
              <DialogTitle className="truncate text-[15px] font-semibold">
                Kudos for {name}
              </DialogTitle>
              <DialogDescription className="truncate text-xs text-[var(--color-subtitle)]">
                @{recipient.username} will see it on their profile
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="cursor-pointer rounded-full p-1.5 text-[var(--color-subtitle)] transition-colors hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* The note */}
          <textarea
            autoFocus
            value={message}
            maxLength={MAX}
            rows={4}
            disabled={outOfGlows}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
            }}
            placeholder={
              outOfGlows
                ? "You've sent all your kudos for today."
                : "Say something nice…"
            }
            aria-label={`Kudos for ${name}`}
            className="block w-full resize-none bg-transparent px-5 py-4 text-[17px] leading-relaxed outline-none placeholder:text-[var(--color-subtitle)] disabled:cursor-not-allowed"
          />

          {/* Details + send */}
          <div className="flex items-center gap-3 px-5 pb-4">
            <p className="min-w-0 flex-1 truncate text-xs text-[var(--color-subtitle)]">
              {passingOn
                ? "Passing on kudos you received"
                : remaining !== null
                  ? `${remaining} left today`
                  : ""}
              {nearLimit && (
                <span
                  className={`ml-2 tabular-nums ${message.length >= MAX ? "text-red-500" : ""}`}
                >
                  {MAX - message.length}
                </span>
              )}
            </p>
            <button
              type="submit"
              disabled={!canSend}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[var(--button-color-bg)] px-5 text-sm font-semibold text-white transition-[filter,transform,opacity] hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SendGlowDialog;
