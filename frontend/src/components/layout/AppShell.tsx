import LeftNav from "@/features/dashboard/components/LeftNav";
import RightNav from "@/features/dashboard/components/RightNav";
import MobileNav from "./MobileNav";

/** Standard page frame: left nav + content + right sidebar on desktop,
 *  bottom tab bar on smaller screens. */
const AppShell = ({
  children,
  showRight = true,
}: {
  children: React.ReactNode;
  showRight?: boolean;
}) => (
  <div className="Home flex min-h-screen w-full">
    <div className="hidden xl:block">
      <LeftNav />
    </div>

    {/* pb-20 keeps content clear of the mobile bottom bar */}
    <main className="flex flex-1 justify-center px-3 pb-20 xl:pb-0">
      {children}
    </main>

    {showRight && (
      <div className="hidden xl:block">
        <RightNav />
      </div>
    )}

    <MobileNav />
  </div>
);

export default AppShell;
