import { useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetGlowWallQuery } from "@/redux/services/growth";
import { useStoredUser } from "@/utils/auth";
import { Avatar } from "@/features/discover/components/PersonRow";
import GlowChainDialog from "./GlowChainDialog";
import SendGlowDialog from "./SendGlowDialog";
import { useKudosSent } from "./useKudosSent";
import { formatCount } from "@/lib/formatCount";

/** Profile tab: all the nice things people said about this person. */
const GlowWall = ({ profile }) => {
  const me = useStoredUser();
  const myId = me?.user?.account_id;
  const isOwn = String(myId) === String(profile?.id);
  const { data, isLoading } = useGetGlowWallQuery({ account_id: profile?.id });
  const [chainNote, setChainNote] = useState(null);
  const [sendOpen, setSendOpen] = useState(false);
  const kudosSent = useKudosSent(isOwn ? null : profile?.id);

  const name = profile?.firstname || profile?.username;
  const notes = data?.notes ?? [];

  return (
    <div className="mt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <p className="font-semibold">
            {formatCount(data?.count ?? 0)} kudos received
          </p>
          <p className="text-sm text-[var(--color-subtitle)]">
            {isOwn
              ? "Things people appreciate about you. Pass kudos on to keep the chain going!"
              : `Things people appreciate about ${name}.`}
          </p>
        </div>
        {me && !isOwn && (
          <Button
            onClick={() => setSendOpen(true)}
            disabled={kudosSent}
            title={
              kudosSent ? "You can send them kudos again tomorrow" : undefined
            }
            className="cursor-pointer bg-[var(--button-color-bg)] text-white hover:opacity-90"
          >
            {kudosSent ? "Kudos sent today" : "Send kudos"}
          </Button>
        )}
        {!me && (
          <Button asChild variant="outline">
            <Link to="/register">Join to send kudos</Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <Loader2 className="mx-auto my-10 animate-spin" />
      ) : notes.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-subtitle)]">
          {isOwn
            ? "No kudos yet. Send someone kudos and it may come back around."
            : `Be the first to send ${name} kudos.`}
        </p>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {notes.map((n) => (
            <figure
              key={n.id}
              className="mb-4 break-inside-avoid rounded-xl border bg-[var(--background)] p-4 transition-colors hover:border-[color-mix(in_srgb,var(--button-color-bg)_45%,transparent)]"
            >
              <blockquote className="text-[15px] leading-relaxed [overflow-wrap:anywhere]">
                “{n.message}”
              </blockquote>
              <figcaption className="mt-3 flex items-center justify-between gap-2">
                <Link
                  to={`/profile/${n.sender.id}`}
                  className="flex min-w-0 items-center gap-2 text-xs"
                >
                  <Avatar
                    src={n.sender.profile_photo}
                    alt={n.sender.username}
                    className="h-7 w-7"
                  />
                  <span className="truncate font-semibold">
                    @{n.sender.username}
                  </span>
                  <span className="shrink-0 text-[var(--color-subtitle)]">
                    {String(n.created_at).replace(/^•\s*/, "")}
                  </span>
                </Link>
                {n.chain_length > 1 && (
                  <button
                    type="button"
                    onClick={() => setChainNote(n.id)}
                    className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[var(--photo-bg)] px-2 py-1 text-[11px] hover:bg-[var(--button-hover-bg-color)]"
                    title="See the chain"
                  >
                    <Link2 className="h-3 w-3" />
                    Chain of {n.chain_length}
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <GlowChainDialog noteId={chainNote} onClose={() => setChainNote(null)} />
      {profile && (
        <SendGlowDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          recipient={profile}
        />
      )}
    </div>
  );
};

export default GlowWall;
