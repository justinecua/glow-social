import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, SquarePlus, type LucideIcon } from "lucide-react";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import SkeletonLeftNav from "./Skeleton/skeletonLeftNav";
import CreatePostDialog from "./modal/CreatePostDialog";
import NotifLeftBar from "./Notifications/NotifLeftBar";
import NotificationsCount from "./Notifications/NotifCount";
import {
  guestLinks,
  isActive,
  memberLinks,
} from "@/components/layout/navItems";

const rowClass = (active: boolean) =>
  `group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors cursor-pointer ${
    active
      ? // Brand-blue tint (works in light and dark) instead of grey
        "bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] font-semibold text-[var(--button-color-bg)] dark:bg-[color-mix(in_srgb,var(--button-color-bg)_22%,transparent)] dark:text-white"
      : "hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--button-text-color)] dark:hover:bg-[var(--button-bg-color)] dark:hover:text-white"
  }`;

const IconBox = ({
  icon: Icon,
  active,
  children,
}: {
  icon: LucideIcon;
  active?: boolean;
  children?: React.ReactNode;
}) => (
  <span
    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${
      active
        ? "border-transparent bg-[var(--button-color-bg)] text-white shadow-[0_2px_10px_color-mix(in_srgb,var(--button-color-bg)_35%,transparent)]"
        : ""
    }`}
  >
    <Icon className="h-[1.1rem] w-[1.1rem]" />
    {children}
  </span>
);

const NavLinkRow = ({
  to,
  label,
  icon,
  pathname,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
}) => {
  const active = isActive(pathname, to);
  return (
    <Link to={to} className={rowClass(active)} aria-current={active ? "page" : undefined}>
      <IconBox icon={icon} active={active} />
      <span>{label}</span>
    </Link>
  );
};

const Brand = () => (
  <Link to="/" className="mb-6 flex h-[50px] items-center px-2">
    <span className="title-font text-xl text-[var(--title-color)]">glow</span>
  </Link>
);

const LeftNav = () => {
  const user = useStoredUser() as any;
  const { pathname } = useLocation();
  const dialogRef = useRef<any>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const checking = useAuthChecking();

  const shell =
    "Left fixed flex h-full w-xs flex-col justify-between overflow-y-auto bg-[var(--home-card)] p-7";

  if (checking) return <SkeletonLeftNav />;

  if (!user) {
    return (
      <nav className={shell} aria-label="Main">
        <div>
          <Brand />
          <div className="flex flex-col gap-1">
            {guestLinks.map((l) => (
              <NavLinkRow key={l.to} {...l} pathname={pathname} />
            ))}
          </div>
        </div>
        <div className="px-2">
          <ModeToggle />
        </div>
      </nav>
    );
  }

  const accountId = user?.user?.account_id;
  // Navigation only; profile, settings, invite and logout live in the
  // right sidebar.
  const links = memberLinks(accountId).filter((l) =>
    ["Home", "Explore", "Search", "Friends"].includes(l.label)
  );

  return (
    <>
      <CreatePostDialog ref={dialogRef} />
      <nav className={shell} aria-label="Main">
        <div>
          <Brand />
          <div className="flex flex-col gap-1">
            {links.slice(0, 3).map((l) => (
              <NavLinkRow key={l.to} {...l} pathname={pathname} />
            ))}

            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              className={rowClass(showNotifications)}
              aria-expanded={showNotifications}
            >
              <IconBox icon={Bell} active={showNotifications}>
                <span className="absolute -top-2 -right-2">
                  <NotificationsCount />
                </span>
              </IconBox>
              <span>Notifications</span>
            </button>

            {links.slice(3).map((l) => (
              <NavLinkRow key={l.to} {...l} pathname={pathname} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.open()}
            className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--button-color-bg)] py-3 text-sm font-semibold text-white shadow-[0_4px_14px_color-mix(in_srgb,var(--button-color-bg)_35%,transparent)] transition-opacity hover:opacity-90"
          >
            <SquarePlus className="h-4 w-4" />
            Create post
          </button>
        </div>

        <div className="px-2">
          <ModeToggle />
        </div>
      </nav>
      {showNotifications && <NotifLeftBar ref={notificationRef} />}
    </>
  );
};

export default LeftNav;
