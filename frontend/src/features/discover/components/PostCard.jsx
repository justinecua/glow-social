import { Card, CardContent } from "@/components/ui/card";
import PostTopNav from "@/features/dashboard/components/Feed/PostTopNav";
import PostCaptions from "@/features/dashboard/components/Feed/PostCaptions";
import PostPhotos from "@/features/dashboard/components/Feed/PostPhotos";
import PostReactions from "@/features/dashboard/components/Feed/PostReactions";
import { useLivePost } from "@/features/posts/livePosts";

/** Same post card as the home feed, for Explore and Search results. */
const PostCard = ({ post: rawPost, onPhotoClick }) => {
  // Reflects edits from the ⋯ menu; disappears once deleted.
  const live = useLivePost(rawPost);
  if (!live) return null;
  const post = live;
  return (
    <Card className="mb-3 bg-[var(--home-card)]">
      <CardContent>
        <PostTopNav post={post} />
        <PostCaptions post={post} />
        <PostPhotos post={post} onPhotoClick={onPhotoClick} />
        <PostReactions item={post} isProfile={false} />
      </CardContent>
    </Card>
  );
};

export default PostCard;
