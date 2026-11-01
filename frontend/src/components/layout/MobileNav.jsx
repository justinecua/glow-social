import { Link, useLocation } from "react-router-dom";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import { Skeleton } from "@/components/ui/skeleton";
import UnreadBadge from "@/features/messages/UnreadBadge";
import { guestAuthLinks, guestLinks, isActive, memberLinks } from "./navItems";

/** Bottom tab bar for screens below xl, where the sidebars are hidden. */
const MobileNav = () => {
  const user = useStoredUser();
  const { pathname } = useLocation();
  const checking = useAuthChecking();

  if (checking) {
    return (
      <nav
        aria-hidden
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--home-card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur xl:hidden"
      >
        <ul className="mx-auto flex max-w-xl justify-around">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex flex-1 flex-col items-center gap-1 py-2">
              <Skeleton className="h-5 w-5 rounded-md" />
              <Skeleton className="h-2 w-8" />
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  const items = user
    ? memberLinks(user?.user?.account_id).filter((l) =>
        ["Home", "Explore", "Messages", "Friends", "Profile"].includes(l.label)
      )
    : [...guestLinks.slice(0, 3), guestAuthLinks[0]];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--home-card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur xl:hidden"
    >
      <ul className="mx-auto flex max-w-xl justify-around">
        {items.map(({ to, label, icon: Icon }) => {
          const active = isActive(pathname, to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                  active
                    ? "text-[var(--title-color)] font-semibold"
                    : "text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
                }`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {user && to === "/messages" && (
                    <UnreadBadge className="absolute -right-2.5 -top-1.5" />
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileNav;
