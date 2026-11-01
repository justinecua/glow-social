import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGetMyFriendsQuery } from "@/redux/services/discover";
import { Avatar } from "@/features/discover/components/PersonRow";
import { personName } from "./chatUtils";

/** Pick friends to chat with (new chat) or to add to a group. */
const PickFriendsDialog = ({
  open,
  onOpenChange,
  title,
  confirmLabel,
  exclude = [],
  allowGroupName = false,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  confirmLabel: (count: number) => string;
  exclude?: number[];
  allowGroupName?: boolean;
  busy?: boolean;
  onConfirm: (ids: number[], groupName: string) => void;
}) => {
  const { data, isLoading } = useGetMyFriendsQuery(undefined, { skip: !open });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    if (!open) {
      setQ("");
      setPicked([]);
      setGroupName("");
    }
  }, [open]);

  const friends = useMemo(() => {
    const all = (data?.friends ?? []).filter((f: any) => !exclude.includes(f.id));
    const needle = q.trim().toLowerCase();
    return needle
      ? all.filter((f: any) =>
          `${f.username} ${f.firstname} ${f.lastname}`.toLowerCase().includes(needle)
        )
      : all;
  }, [data, q, exclude]);

  const toggle = (id: number) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col bg-[var(--home-card)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>You can message your friends.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-subtitle)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search friends"
            className="h-10 w-full rounded-lg border bg-transparent pl-9 pr-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <div className="-mx-2 min-h-[160px] flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <Loader2 className="mx-auto mt-10 animate-spin" />
          ) : friends.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-subtitle)]">
              {q ? "No friends match." : "Add friends first to start chatting."}
            </p>
          ) : (
            friends.map((f: any) => {
              const on = picked.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  aria-pressed={on}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--button-hover-bg-color)]"
                >
                  <Avatar src={f.profile_photo} alt={f.username} className="h-10 w-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{personName(f)}</span>
                    <span className="block truncate text-xs text-[var(--color-subtitle)]">@{f.username}</span>
                  </span>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      on ? "border-transparent bg-[var(--button-color-bg)] text-white" : ""
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {allowGroupName && picked.length > 1 && (
          <input
            value={groupName}
            maxLength={60}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (optional)"
            className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        )}

        <Button
          disabled={!picked.length || busy}
          onClick={() => onConfirm(picked, groupName)}
          className="cursor-pointer bg-[var(--button-color-bg)] text-white hover:opacity-90"
        >
          {busy && <Loader2 className="animate-spin" />}
          {confirmLabel(picked.length)}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default PickFriendsDialog;
