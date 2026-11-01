import {
  Compass,
  House,
  MessageCircle,
  Info,
  LogIn,
  Search,
  Settings,
  UserPlus,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavLinkItem = { to: string; label: string; icon: LucideIcon };

export const guestLinks: NavLinkItem[] = [
  { to: "/", label: "Home", icon: House },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/search", label: "Search", icon: Search },
  { to: "/about", label: "About", icon: Info },
];

export const guestAuthLinks: NavLinkItem[] = [
  { to: "/login", label: "Log in", icon: LogIn },
  { to: "/register", label: "Sign up", icon: UserPlus },
];

/** Links for signed-in users. Create / Notifications / Logout are actions,
 *  rendered separately by the nav. */
export const memberLinks = (accountId?: number | string): NavLinkItem[] => [
  { to: "/", label: "Home", icon: House },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/search", label: "Search", icon: Search },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/friends", label: "Friends", icon: UsersRound },
  ...(accountId
    ? [{ to: `/profile/${accountId}`, label: "Profile", icon: UserRound }]
    : []),
  { to: "/settings", label: "Settings", icon: Settings },
];

export const isActive = (pathname: string, to: string) =>
  to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
