import LeftNav from "@/features/dashboard/components/LeftNav";
import RightNav from "@/features/dashboard/components/RightNav";
import { useLocation } from "react-router-dom";
import MobileNav from "./MobileNav";
import { useSidebars } from "./useSidebars";

/** Standard page frame: left nav + content + right sidebar on desktop,
 *  bottom tab bar on smaller screens. */
const AppShell = ({ children, showRight = true }) => {
  const { leftCollapsed, rightCollapsed } = useSidebars();
  const { pathname } = useLocation();
  // Reserve the fixed sidebars' width (full 20rem or rail 5rem, +1rem gap).
  const pl = leftCollapsed ? "xl:pl-[6rem]" : "xl:pl-[21rem]";
  const pr = !showRight ? "xl:pr-4" : rightCollapsed ? "xl:pr-[6rem]" : "xl:pr-[21rem]";
  return (
    <div className="Home flex min-h-screen w-full">
      <div className="hidden xl:block">
        <LeftNav />
      </div>

      {/* pb-20 keeps content clear of the mobile bottom bar */}
      <main
        className={`flex min-w-0 flex-1 justify-center px-3 pb-20 transition-[padding] duration-200 xl:pb-0 ${pl} ${pr}`}
      >
        <div key={pathname} className="page-enter flex w-full min-w-0 justify-center">
          {children}
        </div>
      </main>

      {showRight && (
        <div className="hidden xl:block">
          <RightNav />
        </div>
      )}

      <MobileNav />
    </div>
  );
};

export default AppShell;
