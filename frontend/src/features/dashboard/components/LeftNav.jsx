import { useEffect, useRef, useState } from "react";
import GlowLogo from "@/components/layout/GlowLogo";
import { Link, useLocation } from "react-router-dom";
import { Bell, PanelLeftClose, PanelLeftOpen, Plus, SquarePlus } from "lucide-react";
import { useSidebars } from "@/components/layout/useSidebars";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import SkeletonLeftNav from "./Skeleton/skeletonLeftNav";
import CreatePostDialog from "./modal/CreatePostDialog";
import NotifLeftBar from "./Notifications/NotifLeftBar";
import NotificationsCount from "./Notifications/NotifCount";
import UnreadBadge from "@/features/messages/UnreadBadge";
import { guestLinks, isActive, memberLinks } from "@/components/layout/navItems";

const rowClass = (active, collapsed = false) =>
  `group flex w-full items-center gap-3 rounded-lg py-3 text-sm transition-colors cursor-pointer ${
    collapsed ? "justify-center px-0" : "px-3"
  } ${
    active
      ? "font-semibold text-[var(--button-color-bg)] dark:text-white" // quiet: colour only, so the logo stays the loudest thing
      : "text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)] dark:hover:bg-[var(--button-bg-color)] dark:hover:text-white"
  }`;

const IconBox = ({ icon: Icon, active, children }) => (
  <span
    className="relative flex h-6 w-6 shrink-0 items-center justify-center"
  >
    <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} />
    {children}
  </span>
);

const NavLinkRow = ({ to, label, icon, pathname, badge, collapsed = false }) => {
  const active = isActive(pathname, to);
  return (
    <Link
      to={to}
      className={rowClass(active, collapsed)}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
    >
      <IconBox icon={icon} active={active}>
        {badge && <span className="absolute -top-0.5 -right-0.5">{badge}</span>}
      </IconBox>
      <span className={collapsed ? "sr-only" : ""}>{label}</span>
    </Link>
  );
};

const Brand = ({ collapsed = false }) => (
  <Link
    to="/"
    aria-label="Glow home"
    className={`group mb-6 flex items-center pt-2 ${collapsed ? "justify-center" : "px-2"}`}
  >
    {collapsed ? (
      <GlowLogo variant="mark" animated className="glow-lockup h-10 w-10" title="" />
    ) : (
      <span className="title-font glow-lockup flex items-baseline !text-[2.4rem] leading-none">
        <span className="glow-wordmark">gl</span>
        <GlowLogo
          variant="mark"
          animated
          className="mx-[0.02em] h-[0.95em] w-[0.95em] shrink-0 self-center translate-y-[0.02em]"
          title=""
        />
        <span className="glow-wordmark">w</span>
      </span>
    )}
  </Link>
);

/** Collapse / expand the sidebar to an icon rail. */
const CollapseButton = ({ collapsed, onClick }) => {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border text-[var(--color-subtitle)] transition-colors hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]"
    >
      <Icon className="h-[1.1rem] w-[1.1rem]" />
    </button>
  );
};

const LeftNav = () => {
  const user = useStoredUser();
  const { pathname } = useLocation();
  const dialogRef = useRef(null);
  const notificationRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const checking = useAuthChecking();
  const { leftCollapsed: collapsed, toggleLeft } = useSidebars();

  const shell = `Left fixed flex h-full flex-col justify-between overflow-y-auto overflow-x-hidden bg-[var(--home-card)] transition-[width,padding] duration-200 ${
    collapsed ? "w-20 px-3 py-7" : "w-xs p-7"
  }`;
  const footer = (
    <div className={`flex gap-2 ${collapsed ? "flex-col items-center" : "items-center px-2"}`}>
      {/* ModeToggle is full-width with a right margin; keep it icon-sized here */}
      <div className="w-9 shrink-0 [&_button]:mr-0">
        <ModeToggle />
      </div>
      <CollapseButton collapsed={collapsed} onClick={toggleLeft} />
    </div>
  );

  if (checking) return <SkeletonLeftNav />;

  if (!user) {
    return (
      <nav className={shell} aria-label="Main">
        <div>
          <Brand collapsed={collapsed} />
          <div className="flex flex-col gap-1">
            {guestLinks.map((l) => (
              <NavLinkRow key={l.to} {...l} pathname={pathname} collapsed={collapsed} />
            ))}
          </div>
        </div>
        {footer}
      </nav>
    );
  }

  const accountId = user?.user?.account_id;
  // Navigation only; profile, settings, invite and logout live in the
  // right sidebar.
  const links = memberLinks(accountId).filter((l) =>
    ["Home", "Explore", "Search", "Messages", "Friends"].includes(l.label)
  );

  return (
    <>
      <CreatePostDialog ref={dialogRef} />
      <nav className={shell} aria-label="Main">
        <div>
          <Brand collapsed={collapsed} />
          <div className="flex flex-col gap-1">
            {links.slice(0, 3).map((l) => (
              <NavLinkRow key={l.to} {...l} pathname={pathname} collapsed={collapsed} />
            ))}

            <button
              type="button"
              onClick={() => setShowNotifications((prev) => !prev)}
              className={rowClass(showNotifications, collapsed)}
              aria-expanded={showNotifications}
              aria-label="Notifications"
              title={collapsed ? "Notifications" : undefined}
            >
              <IconBox icon={Bell} active={showNotifications}>
                <span className="absolute -top-0.5 -right-0.5">
                  <NotificationsCount />
                </span>
              </IconBox>
              <span className={collapsed ? "sr-only" : ""}>Notifications</span>
            </button>

            {links.slice(3).map((l) => (
              <NavLinkRow
                key={l.to}
                {...l}
                pathname={pathname}
                collapsed={collapsed}
                badge={l.to === "/messages" ? <UnreadBadge /> : undefined}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.open()}
            aria-label="Create post"
            title={collapsed ? "Create post" : undefined}
            className={`mt-6 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] text-sm font-semibold text-[var(--button-color-bg)] transition-colors hover:bg-[color-mix(in_srgb,var(--button-color-bg)_16%,transparent)] dark:bg-[color-mix(in_srgb,var(--button-color-bg)_24%,transparent)] dark:text-white ${
              collapsed ? "mx-auto h-11 w-11" : "w-full py-3"
            }`}
          >
            {collapsed ? <Plus className="h-5 w-5" /> : <SquarePlus className="h-4 w-4" />}
            {!collapsed && "Create post"}
          </button>
        </div>

        {footer}
      </nav>
      {showNotifications && (
        <NotifLeftBar
          ref={notificationRef}
          leftOffset={collapsed ? "6rem" : "21rem"}
          onNavigate={() => setShowNotifications(false)}
        />
      )}
    </>
  );
};

export default LeftNav;
