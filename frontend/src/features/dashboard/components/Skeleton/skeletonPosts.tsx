import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors a real feed card (PostTopNav, PostCaptions, PostPhotos,
 *  PostReactions) so nothing jumps when posts load. */
const SkeletonPost = ({ withPhoto = true }: { withPhoto?: boolean }) => (
  <Card className="mb-3 bg-[var(--home-card)]" aria-hidden>
    <CardContent>
      {/* avatar · username · time */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>

      {/* caption */}
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>

      {/* photo (4:3, like PostPhotos) */}
      {withPhoto && <Skeleton className="mt-4 mb-2 aspect-[4/3] w-full rounded-lg" />}

      {/* glow · comment … share */}
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-10 w-14 rounded-lg" />
        <Skeleton className="h-10 w-14 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </CardContent>
  </Card>
);

/** A few cards alternating photo / text-only, like a real feed. */
export const SkeletonFeed = ({ count = 3 }: { count?: number }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <SkeletonPost key={i} withPhoto={i % 2 === 0} />
    ))}
  </>
);

export default SkeletonPost;
