import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useGetMyGlowStatusQuery,
  useSendGlowNoteMutation,
} from "@/redux/services/growth";

const MAX = 140;
const SUGGESTIONS = [
  "Thanks for always being there 🙏",
  "You made my day better",
  "Proud of you!",
  "Your posts always make me smile 😊",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: { id: number; username: string; firstname?: string };
};

const SendGlowDialog = ({ open, onOpenChange, recipient }: Props) => {
  const [message, setMessage] = useState("");
  const [sendGlow, { isLoading }] = useSendGlowNoteMutation();
  const { data: status } = useGetMyGlowStatusQuery(undefined, { skip: !open });

  useEffect(() => {
    if (!open) setMessage("");
  }, [open]);

  const name = recipient.firstname || `@${recipient.username}`;
  const remaining = status?.remaining_today ?? null;
  const outOfGlows = remaining === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading || outOfGlows) return;
    try {
      const note = await sendGlow({
        recipient_id: Number(recipient.id),
        message: message.trim(),
      }).unwrap();
      toast.success(
        note.chain_length > 1
          ? `Kudos passed on! This chain is now ${note.chain_length} people long.`
          : `You sent ${name} kudos.`
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.data?.detail || "Couldn't send your kudos. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--home-card)] sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Send {name} kudos
            </DialogTitle>
            <DialogDescription>
              A short note of appreciation. It'll appear in their Kudos tab.
            </DialogDescription>
          </DialogHeader>

          {status?.passes_available > 0 && (
            <p className="rounded-lg bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] px-3 py-2 text-xs dark:bg-[color-mix(in_srgb,var(--button-color-bg)_22%,transparent)]">
              You're passing on kudos someone sent you, so this adds to their chain.
            </p>
          )}

          <div>
            <textarea
              autoFocus
              value={message}
              maxLength={MAX}
              rows={3}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`What do you appreciate about ${name}?`}
              className="w-full resize-none rounded-lg border bg-transparent p-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <div className="mt-1 flex justify-between text-xs text-[var(--color-subtitle)]">
              <span>
                {remaining !== null && `${remaining} kudos left today`}
              </span>
              <span>
                {message.length}/{MAX}
              </span>
            </div>
          </div>

          {!message && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMessage(s)}
                  className="cursor-pointer rounded-full bg-[var(--photo-bg)] px-3 py-1 text-xs hover:bg-[var(--button-hover-bg-color)]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={!message.trim() || isLoading || outOfGlows}
              className="cursor-pointer bg-[var(--button-color-bg)] text-white hover:opacity-90"
            >
              {isLoading && <Loader2 className="animate-spin" />}
              {outOfGlows ? "No kudos left today" : "Send kudos"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SendGlowDialog;
