import { Button } from "@/components/ui/button";
import { useGetNewUsersQuery } from "@/redux/services/accounts/accounts";
import NoProfile from "../../../assets/images/No-Profile.jpg";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, LogIn, LogOut, PanelRightClose, PanelRightOpen, Settings, UserPlus } from "lucide-react";
import { useSidebars } from "@/components/layout/useSidebars";
import LogoutConfirmDialog from "@/components/layout/LogoutConfirmDialog";
import InviteDialog from "@/features/growth/InviteDialog";
import { useGetMyInvitesQuery } from "@/redux/services/growth";
import { useGetExploreQuery } from "@/redux/services/discover";
import { Avatar } from "@/features/discover/components/PersonRow";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import LegalLinks from "@/features/legal/components/LegalLinks";
import { formatCount } from "@/lib/formatCount";

const displayName = (u: any) =>
  [u?.firstname, u?.lastname].filter(Boolean).join(" ") || u?.username || "";

const railBtn =
  "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--color-subtitle)] transition-colors hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]";

/** Collapse / expand the right sidebar. */
const RightToggle = ({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) => {
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border text-[var(--color-subtitle)] transition-colors hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]"
    >
      <Icon className="h-[1.1rem] w-[1.1rem]" />
    </button>
  );
};

const railShell =
  "Left fixed right-0 hidden h-full w-20 flex-col items-center justify-between gap-4 overflow-y-auto overflow-x-hidden bg-[var(--home-card)] px-3 py-7 xl:flex";

/** Collapsed right sidebar: the same actions, as icons. */
const RightRail = ({ user, onExpand }: { user: any; onExpand: () => void }) => {
  const me = user?.user ?? null;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <aside className={railShell} aria-label="Sidebar">
      <div className="flex flex-col items-center gap-2">
        {me ? (
          <>
            <Link to={`/profile/${me.account_id}`} title={`${displayName(me)} (your profile)`} className="mb-2">
              <Avatar src={me.profile_photo} alt={me.username} className="h-11 w-11" />
            </Link>
            <Link to="/settings" className={railBtn} aria-label="Settings" title="Settings">
              <Settings className="h-5 w-5" />
            </Link>
            <button type="button" onClick={() => setInviteOpen(true)} className={railBtn} aria-label="Invite friends" title="Invite friends">
              <Gift className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setConfirmLogout(true)} className={railBtn} aria-label="Log out" title="Log out">
              <LogOut className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className={railBtn} aria-label="Log in" title="Log in">
              <LogIn className="h-5 w-5" />
            </Link>
            <Link to="/register" className={railBtn} aria-label="Create account" title="Create account">
              <UserPlus className="h-5 w-5" />
            </Link>
          </>
        )}

      </div>

      <RightToggle collapsed onClick={onExpand} />

      {me && (
        <>
          <LogoutConfirmDialog open={confirmLogout} onOpenChange={setConfirmLogout} />
          <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} username={me.username} />
        </>
      )}
    </aside>
  );
};

/** Signed-in right sidebar: you, inviting friends, people to discover. */
const MemberPanel = ({ user, onCollapse }: { user: any; onCollapse: () => void }) => {
  const me = user?.user ?? {};
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { data: invites } = useGetMyInvitesQuery(undefined);
  const { data: explore, isLoading: exploreLoading } = useGetExploreQuery(undefined);
  const suggested = (explore?.people ?? [])
    .filter((p: any) => String(p.id) !== String(me.account_id))
    .slice(0, 5);

  const iconBtn =
    "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--color-subtitle)] transition-colors hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]";

  return (
    <Card className="Left bg-[var(--home-card)] w-xs h-full hidden xl:flex flex-col fixed right-0 rounded-none">
      <CardContent className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {/* You */}
        <section className="flex items-center gap-3 rounded-xl border p-3">
          <Link to={`/profile/${me.account_id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar src={me.profile_photo} alt={me.username} className="h-11 w-11" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName(me)}</p>
              <p className="truncate text-xs text-[var(--color-subtitle)]">@{me.username}</p>
            </div>
          </Link>
          <Link to="/settings" className={iconBtn} aria-label="Settings" title="Settings">
            <Settings className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className={iconBtn}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </section>

        {/* Invite */}
        <section className="rounded-xl bg-[color-mix(in_srgb,var(--button-color-bg)_8%,transparent)] p-4 dark:bg-[color-mix(in_srgb,var(--button-color-bg)_18%,transparent)]">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="h-4 w-4 text-[var(--button-color-bg)]" />
            Invite friends
          </p>
          <p className="mt-1 text-xs text-[var(--color-subtitle)]">
            {invites?.count
              ? `${formatCount(invites.count)} ${invites.count === 1 ? "person has" : "people have"} joined from your link`
              : "Friends who join with your link are added automatically."}
          </p>
          <Button
            size="sm"
            onClick={() => setInviteOpen(true)}
            className="mt-3 w-full cursor-pointer bg-[var(--button-color-bg)] text-white hover:opacity-90"
          >
            Share invite link
          </Button>
        </section>

        {/* Suggested */}
        {(exploreLoading || suggested.length > 0) && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Suggested for you</p>
              <Link to="/explore" className="text-xs text-[var(--color-subtitle)] hover:underline">
                See all
              </Link>
            </div>
            <div className="flex flex-col">
              {exploreLoading
                ? Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 py-2" aria-hidden>
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                  ))
                : suggested.map((p: any) => (
                    <Link
                      key={p.id}
                      to={`/profile/${p.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--button-hover-bg-color)]"
                    >
                      <Avatar src={p.profile_photo} alt={p.username} className="h-9 w-9" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{displayName(p)}</p>
                        <p className="truncate text-xs text-[var(--color-subtitle)]">@{p.username}</p>
                      </div>
                    </Link>
                  ))}
            </div>
          </section>
        )}

        <div className="mt-auto">
          <div className="mb-3 flex justify-end">
            <RightToggle collapsed={false} onClick={onCollapse} />
          </div>
          <LegalLinks variant="footer" />
        </div>
      </CardContent>

      <LogoutConfirmDialog open={confirmLogout} onOpenChange={setConfirmLogout} />
      {me.username && (
        <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} username={me.username} />
      )}
    </Card>
  );
};

const RightNav = () => {
  const user = useStoredUser();
  const checking = useAuthChecking();
  const { rightCollapsed, toggleRight } = useSidebars();
  // Only visitors see "New On Glow", so don't fetch (or wait) for it when
  // signed in.
  const { data: newUsers, isLoading } = useGetNewUsersQuery(undefined, {
    skip: !!user || checking,
  });
  const [imgErrors, setImgErrors] = useState({});

  const setImgError = (index) => {
    setImgErrors((prev) => ({ ...prev, [index]: true }));
  };

  if (rightCollapsed && !checking) {
    return <RightRail user={user} onExpand={toggleRight} />;
  }
  if (rightCollapsed && checking) {
    return <aside className={railShell} aria-hidden />;
  }

  // Still checking sign-in: show only what both versions share (the footer)
  // rather than guessing and swapping layouts.
  if (checking) {
    return (
      <Card className="Left bg-[var(--home-card)] w-xs h-full hidden xl:flex flex-col fixed right-0 rounded-none" aria-hidden>
        <CardContent className="flex flex-1 flex-col">
          <LegalLinks variant="footer" className="mt-auto" />
        </CardContent>
      </Card>
    );
  }

  const isAuthenticated = () => <MemberPanel user={user} onCollapse={toggleRight} />;

  const isNotAuthenticated = () => {
    return (
      <Card className="Left bg-[var(--home-card)] w-xs h-full hidden xl:flex flex-col fixed right-0 rounded-none">
        <CardContent className="flex flex-1 flex-col">
          <div className="flex flex-col">
            <span className="text-lg font-bold">First time here? 👋</span>
            <span className="text-sm text-[var(--color-subtitle)] leading-4.5">
              Sign up right now to create your own profile and join the
              community
            </span>
          </div>
          <Link to="/login">
            <Button className="w-full mt-4 p-5.5 bg-[var(--button-bg-color)] text-[var(--button-text-color)] hover:bg-[var(--button-hover-bg-color)] cursor-pointer">
              Login
            </Button>
          </Link>
          <Link to="/register">
            <Button className="w-full mt-2 p-5.5 bg-[var(--button-bg-color)] text-[var(--button-text-color)] hover:bg-[var(--button-hover-bg-color)] cursor-pointer">
              Create Account
            </Button>
          </Link>
          <div className="mt-6 mb-4 text-sm">
            <span>New On Glow</span>

            <div className="mt-4 w-full">
              {isLoading ? (
                // Only the avatar grid is loading; the rest renders right away.
                <div className="grid grid-cols-5 gap-4" aria-hidden>
                  {Array.from({ length: 15 }, (_, i) => (
                    <div key={i} className="flex justify-center">
                      <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : newUsers && newUsers.length > 0 ? (
                <div className="grid grid-cols-5 gap-4">
                  {newUsers.map((user, index) => (
                    <Link to={`/profile/${user?.id}`} key={index}>
                      <div className="flex justify-center">
                        <img
                          src={
                            imgErrors[index] || !user?.profile_photo
                              ? NoProfile
                              : user.profile_photo
                          }
                          alt={user?.username}
                          className="w-9 h-9 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform duration-200"
                          onError={() => setImgError(index)}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--color-subtitle)]">
                  No new users found.
                </p>
              )}
            </div>
          </div>
          <div className="mt-auto">
            <div className="mb-3 flex justify-end">
              <RightToggle collapsed={false} onClick={toggleRight} />
            </div>
            <LegalLinks variant="footer" />
          </div>
        </CardContent>
      </Card>
    );
  };

  const authenticated = () => {
    if (user) {
      return isAuthenticated();
    } else {
      return isNotAuthenticated();
    }
  };

  return authenticated();
};

export default RightNav;
