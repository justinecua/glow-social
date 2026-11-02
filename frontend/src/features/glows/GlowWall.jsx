import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetGlowWallQuery } from "@/redux/services/growth";
import { useStoredUser } from "@/utils/auth";
import { Avatar } from "@/features/discover/components/PersonRow";
import GlowChainDialog from "./GlowChainDialog";
import SendGlowDialog from "./SendGlowDialog";
import { useKudosSent } from "./useKudosSent";
import ChainDots from "./ChainDots";
import { KUDOS_TINT, noteTilt, tintedBg } from "./kudosStyle";

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
      {(!me || !isOwn) && (
        <div className="mb-5 flex justify-end px-1">
          {me ? (
            <Button
              onClick={() => setSendOpen(true)}
              disabled={kudosSent}
              title={kudosSent ? "You can send them kudos again tomorrow" : undefined}
              className="cursor-pointer rounded-full bg-[var(--button-color-bg)] px-5 text-white hover:opacity-90"
            >
              {kudosSent ? "Kudos sent today" : "Send kudos"}
            </Button>
          ) : (
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/register">Join to send kudos</Link>
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <Loader2 className="mx-auto my-10 animate-spin" />
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <span className="mb-3 select-none font-serif text-6xl leading-none text-[var(--color-subtitle)] opacity-40" aria-hidden>
            &ldquo;&rdquo;
          </span>
          <p className="text-sm text-[var(--color-subtitle)]">
            {isOwn
              ? "No kudos yet. Send someone kudos and it may come back around."
              : `Be the first to send ${name} kudos.`}
          </p>
        </div>
      ) : (
        <div className="columns-1 gap-5 px-1 sm:columns-2 lg:columns-3">
          {notes.map((n, i) => (
              <figure
                key={n.id}
                className="group relative mb-5 break-inside-avoid rounded-2xl p-5 pt-6 shadow-sm transition-all duration-300 hover:z-10 hover:!rotate-0 hover:shadow-lg"
                style={{
                  background: tintedBg(10),
                  rotate: `${noteTilt(i)}deg`,
                }}
              >
                <span
                  className="pointer-events-none absolute right-3 top-0 select-none font-serif text-7xl leading-none opacity-25"
                  style={{ color: KUDOS_TINT }}
                  aria-hidden
                >
                  &rdquo;
                </span>
                <blockquote className="relative text-base font-medium leading-relaxed [overflow-wrap:anywhere]">
                  {n.message}
                </blockquote>
                <figcaption className="relative mt-4 flex items-center justify-between gap-2 border-t border-dashed pt-3" style={{ borderColor: `color-mix(in srgb, ${KUDOS_TINT} 35%, transparent)` }}>
                  <Link to={`/profile/${n.sender.id}`} className="flex min-w-0 items-center gap-2 text-xs">
                    <Avatar src={n.sender.profile_photo} alt={n.sender.username} className="h-7 w-7 ring-2 ring-[var(--home-card)]" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">@{n.sender.username}</span>
                      <span className="block text-[11px] text-[var(--color-subtitle)]">
                        {String(n.created_at).replace(/^•\s*/, "")}
                      </span>
                    </span>
                  </Link>
                  {n.chain_length > 1 && (
                    <button
                      type="button"
                      onClick={() => setChainNote(n.id)}
                      className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[var(--home-card)]/70 px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-sm transition-colors hover:bg-[var(--home-card)]"
                      title="See how these kudos travelled"
                    >
                      <ChainDots length={n.chain_length} color={KUDOS_TINT} />
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
