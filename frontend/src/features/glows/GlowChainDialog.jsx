import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGetGlowChainQuery } from "@/redux/services/growth";
import { Avatar } from "@/features/discover/components/PersonRow";
import { useStoredUser } from "@/utils/auth";
import { KUDOS_TINT, tintedBg } from "./kudosStyle";

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

const Relay = ({ people, messages, myId }) => {
  const holder = people[people.length - 1];
  return (
    <ol className="relative">
      {messages.map((m, i) => {
        const from = people[i];
        const to = people[i + 1];
        return (
          <li key={i} className="relative flex gap-3 pb-5">
            <span
              className="absolute bottom-0 left-[17px] top-9 w-0.5 rounded-full"
              style={{ background: `color-mix(in srgb, ${KUDOS_TINT} 40%, transparent)` }}
              aria-hidden
            />
            <Link to={`/profile/${from.id}`} className="relative block h-9 w-9 shrink-0 rounded-full p-0.5" style={{ background: KUDOS_TINT }}>
              <Avatar src={from.profile_photo} alt={from.username} className="h-full w-full ring-2 ring-[var(--home-card)]" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1 text-xs">
                <span className="font-semibold">@{from.username}</span>
                <ArrowRight className="h-3 w-3 text-[var(--color-subtitle)]" />
                <span className="text-[var(--color-subtitle)]">@{to.username}</span>
                <span className="ml-auto rounded-full px-1.5 text-[10px] font-semibold text-[var(--button-color-bg)] dark:text-[#a9b8ff]" style={{ background: tintedBg(14) }}>
                  #{i + 1}
                </span>
              </p>
              <p
                className="mt-1.5 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]"
                style={{ background: tintedBg(10) }}
              >
                {m.message}
              </p>
            </div>
          </li>
        );
      })}
      <li className="flex items-center gap-3">
        <Link to={`/profile/${holder.id}`} className="shrink-0">
          <Avatar src={holder.profile_photo} alt={holder.username} className="h-9 w-9 ring-2 ring-[var(--button-color-bg)]" />
        </Link>
        <p className="text-sm">
          {String(holder.id) === String(myId) ? (
            <>
              <span className="font-semibold">You have it now.</span>{" "}
              <span className="text-[var(--color-subtitle)]">Send someone kudos to keep it going.</span>
            </>
          ) : (
            <>
              <span className="font-semibold">@{holder.username}</span>{" "}
              <span className="text-[var(--color-subtitle)]">has it now.</span>
            </>
          )}
        </p>
      </li>
    </ol>
  );
};

const GlowChainDialog = ({ noteId, onClose }) => {
  const myId = useStoredUser()?.user?.account_id;
  const { data, isLoading } = useGetGlowChainQuery({ note_id: noteId }, { skip: noteId == null });

  return (
    <Dialog open={noteId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto bg-[var(--home-card)] sm:max-w-md">
        <DialogHeader>
          {data && (
            <div className="mb-2 flex -space-x-2">
              {data.people.slice(0, 6).map((p, i) => (
                <Avatar key={`${p.id}-${i}`} src={p.profile_photo} alt={p.username} className="h-8 w-8 ring-2 ring-[var(--home-card)]" />
              ))}
            </div>
          )}
          <DialogTitle>{data ? `A chain of ${data.messages.length} kudos` : "Kudos chain"}</DialogTitle>
          <DialogDescription>Each person received kudos and passed them on. Here's how it travelled.</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Loader2 className="mx-auto animate-spin" />
        ) : (
          <Relay people={data.people} messages={data.messages} myId={myId} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GlowChainDialog;
