import { Skeleton } from "@/components/ui/skeleton";

/** Same shell as LeftNav (brand, nav rows, theme toggle), shown while we
 *  check whether the visitor is signed in. */
const SkeletonLeftNav = () => (
  <nav
    aria-hidden
    className="Left fixed flex h-full w-xs flex-col justify-between bg-[var(--home-card)] p-7"
  >
    <div>
      <div className="mb-6 flex h-[50px] items-center px-2">
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="flex flex-col gap-1">
        {[24, 20, 18, 26, 18].map((w, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-3.5" style={{ width: `${w * 4}px` }} />
          </div>
        ))}
      </div>
    </div>
    <div className="px-2">
      <Skeleton className="h-9 w-9 rounded-md" />
    </div>
  </nav>
);

export default SkeletonLeftNav;
