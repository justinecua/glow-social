import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Diamond, LogOut, Star, Type, UserPlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/features/discover/components/PersonRow";
import SendGlowDialog from "@/features/glows/SendGlowDialog";
import { useGetProfileQuery } from "@/redux/services/accounts/accounts";
import { useGetGlowWallQuery } from "@/redux/services/growth";
import { useGetMyFriendsQuery, useSetCloseFriendMutation } from "@/redux/services/discover";
import type { Conversation } from "@/redux/services/messages";
import { formatCount } from "@/lib/formatCount";
import { ChatAvatar, otherMembers, personName } from "./chatUtils";

const sectionTitle = "mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtitle)]";
const actionRow =
  "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-[var(--button-hover-bg-color)]";

const Panel = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
  <aside className="relative hidden h-full w-80 shrink-0 flex-col overflow-y-auto border-l custom-scrollbar lg:flex">
    <button
      type="button"
      onClick={onClose}
      aria-label="Hide details"
      title="Hide details"
      className="absolute right-3 top-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
    >
      <X className="h-4 w-4" />
    </button>
    {children}
  </aside>
);

/** Right-hand details for a 1:1 chat: who you're talking to. */
const PersonDetails = ({ personId, onClose }: { personId: number; onClose: () => void }) => {
  const { data, isLoading } = useGetProfileQuery({ profile_id: personId });
  const profile = Array.isArray(data) ? data[0] : null;
  const { data: wall } = useGetGlowWallQuery({ account_id: personId });
  const { data: friends } = useGetMyFriendsQuery(undefined);
  const [setCloseFriend] = useSetCloseFriendMutation();
  const [glowOpen, setGlowOpen] = useState(false);

  const friend = (friends?.friends ?? []).find((f: any) => f.id === personId);
  const isClose = !!friend?.is_close;
  const joined = profile?.date_joined
    ? new Date(profile.date_joined).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";
  const bio = profile?.bio && profile.bio !== "None" ? profile.bio : "";

  return (
    <Panel onClose={onClose}>
      {/* Cover + avatar */}
      <div className="relative h-28 shrink-0 bg-[color-mix(in_srgb,var(--button-color-bg)_25%,transparent)]">
        {profile?.cover_photo && (
          <img src={profile.cover_photo} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="-mt-10 px-5">
        {isLoading || !profile ? (
          <>
            <Skeleton className="h-20 w-20 rounded-full ring-4 ring-[var(--home-card)]" />
            <Skeleton className="mt-3 h-5 w-36" />
            <Skeleton className="mt-2 h-3.5 w-24" />
          </>
        ) : (
          <>
            <Link to={`/profile/${personId}`}>
              <Avatar
                src={profile.profile_photo}
                alt={profile.username}
                className="h-20 w-20 ring-4 ring-[var(--home-card)]"
              />
            </Link>
            <h2 className="mt-3 text-lg font-bold leading-tight">{personName(profile)}</h2>
            <p className="text-sm text-[var(--color-subtitle)]">@{profile.username}</p>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-5 px-5 pb-6">
        {bio && (
          <section>
            <p className={sectionTitle}>About</p>
            <p className="whitespace-pre-line text-sm [overflow-wrap:anywhere]">{bio}</p>
          </section>
        )}

        <section className="flex flex-col gap-2 text-sm">
          {joined && (
            <p className="flex items-center gap-2 text-[var(--color-subtitle)]">
              <CalendarDays className="h-4 w-4" /> Joined {joined}
            </p>
          )}
          <Link
            to={`/profile/${personId}?tab=glows`}
            className="flex items-center gap-2 text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
          >
            <Diamond className="h-4 w-4" />
            {formatCount(wall?.count ?? 0)} glow{wall?.count === 1 ? "" : "s"} received
          </Link>
        </section>

        <section className="-mx-2 border-t pt-3">
          <Link to={`/profile/${personId}`} className={actionRow}>
            <UserRound className="h-4 w-4" /> View profile
          </Link>
          <button type="button" onClick={() => setGlowOpen(true)} className={actionRow}>
            <Diamond className="h-4 w-4" /> Send kudos
          </button>
          {friend && (
            <button
              type="button"
              aria-pressed={isClose}
              onClick={() =>
                setCloseFriend({ account_id: personId, close: !isClose })
                  .unwrap()
                  .then(() =>
                    toast.success(isClose ? "Removed from Close friends" : "Added to Close friends")
                  )
                  .catch(() => toast.error("Couldn't update Close friends."))
              }
              className={actionRow}
            >
              <Star
                className={`h-4 w-4 ${isClose ? "text-[var(--button-color-bg)] dark:text-white" : ""}`}
                fill={isClose ? "currentColor" : "none"}
              />
              {isClose ? "Close friend" : "Add to Close friends"}
            </button>
          )}
        </section>
      </div>

      {profile && (
        <SendGlowDialog
          open={glowOpen}
          onOpenChange={setGlowOpen}
          recipient={{ id: personId, username: profile.username, firstname: profile.firstname }}
        />
      )}
    </Panel>
  );
};

/** Right-hand details for a group chat: members and group actions. */
const GroupDetails = ({
  conv,
  myId,
  onClose,
  onRename,
  onAddPeople,
  onLeave,
}: {
  conv: Conversation;
  myId: number;
  onClose: () => void;
  onRename: () => void;
  onAddPeople: () => void;
  onLeave: () => void;
}) => (
  <Panel onClose={onClose}>
    <div className="flex flex-col items-center px-5 pb-4 pt-10 text-center">
      <ChatAvatar conversation={conv} myId={myId} size="h-20 w-20" />
      <h2 className="mt-3 text-lg font-bold leading-tight [overflow-wrap:anywhere]">{conv.name}</h2>
      <p className="text-sm text-[var(--color-subtitle)]">{conv.members.length} members</p>
    </div>

    <div className="flex flex-col gap-5 px-5 pb-6">
      <section>
        <p className={sectionTitle}>Members</p>
        <div className="-mx-2">
          {conv.members.map((m) => (
            <Link key={m.id} to={`/profile/${m.id}`} className={actionRow}>
              <Avatar src={m.profile_photo} alt={m.username} className="h-8 w-8" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {personName(m)}
                  {m.id === myId && <span className="font-normal text-[var(--color-subtitle)]"> (you)</span>}
                </span>
                <span className="block truncate text-xs text-[var(--color-subtitle)]">@{m.username}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="-mx-2 border-t pt-3">
        <button type="button" onClick={onAddPeople} className={actionRow}>
          <UserPlus className="h-4 w-4" /> Add people
        </button>
        <button type="button" onClick={onRename} className={actionRow}>
          <Type className="h-4 w-4" /> Rename group
        </button>
        <button type="button" onClick={onLeave} className={`${actionRow} text-red-500`}>
          <LogOut className="h-4 w-4" /> Leave group
        </button>
      </section>
    </div>
  </Panel>
);

const ChatDetails = (props: {
  conv: Conversation;
  myId: number;
  onClose: () => void;
  onRename: () => void;
  onAddPeople: () => void;
  onLeave: () => void;
}) => {
  if (props.conv.is_group) return <GroupDetails {...props} />;
  const other = otherMembers(props.conv, props.myId)[0];
  if (!other) return null;
  return <PersonDetails key={other.id} personId={other.id} onClose={props.onClose} />;
};

export default ChatDetails;
