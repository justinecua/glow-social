import { Card, CardContent } from "@/components/ui/card";
import PostTopNav from "@/features/dashboard/components/Feed/PostTopNav";
import PostCaptions from "@/features/dashboard/components/Feed/PostCaptions";
import PostPhotos from "@/features/dashboard/components/Feed/PostPhotos";
import PostReactions from "@/features/dashboard/components/Feed/PostReactions";

/** Same post card as the home feed, for Explore and Search results. */
const PostCard = ({
  post,
  onPhotoClick,
}: {
  post: any;
  onPhotoClick?: (index: number) => void;
}) => (
  <Card className="mb-3 bg-[var(--home-card)]">
    <CardContent>
      <PostTopNav post={post} />
      <PostCaptions post={post} />
      <PostPhotos post={post} onPhotoClick={onPhotoClick} />
      <PostReactions item={post} isProfile={false} />
    </CardContent>
  </Card>
);

export default PostCard;
