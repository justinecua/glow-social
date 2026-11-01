import { Link } from "react-router-dom";
import { ChevronRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGetGlowChainQuery } from "@/redux/services/growth";
import { Avatar } from "@/features/discover/components/PersonRow";

export const ChainPeople = ({ people }) => (
  <div className="flex flex-wrap items-center gap-1">
    {people.map((p, i) => (
      <span key={`${p.id}-${i}`} className="flex items-center gap-1">
        {i > 0 && (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--color-subtitle)]" />
        )}
        <Link
          to={`/profile/${p.id}`}
          className="flex items-center gap-1.5 rounded-full bg-[var(--photo-bg)] py-0.5 pl-0.5 pr-2.5 text-xs hover:bg-[var(--button-hover-bg-color)]"
        >
          <Avatar src={p.profile_photo} alt={p.username} className="h-6 w-6" />@
          {p.username}
        </Link>
      </span>
    ))}
  </div>
);

const GlowChainDialog = ({ noteId, onClose }) => {
  const { data, isLoading } = useGetGlowChainQuery(
    { note_id: noteId },
    { skip: noteId == null },
  );

  return (
    <Dialog open={noteId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[var(--home-card)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kudos chain</DialogTitle>
          <DialogDescription>
            Each person received kudos and passed them on.
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Loader2 className="mx-auto animate-spin" />
        ) : (
          <div className="flex flex-col gap-4">
            <ChainPeople people={data.people} />
            <ol className="flex flex-col gap-2 border-l-2 border-[var(--button-color-bg)]/40 pl-4">
              {data.messages.map((m, i) => (
                <li key={i} className="text-sm">
                  <span className="font-semibold">@{m.from}</span>{" "}
                  <span className="text-[var(--color-subtitle)]">
                    “{m.message}”
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GlowChainDialog;
