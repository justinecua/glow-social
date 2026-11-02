import ExpandableText from "@/components/ui/custom/expandable";
import LinkPreview, { findUrls } from "@/features/posts/LinkPreview";
import TrendCard, { parseTrend } from "@/features/posts/TrendCard";
import PollView from "@/features/posts/PollView";
import GameCard from "@/features/games/GameCard";

const PostCaptions = ({ post }) => {
  if (!post?.caption) {
    if (post?.game) return <GameCard game={post.game} />;
    return post?.poll ? <PollView postId={post.id} poll={post.poll} /> : null;
  }

  // @glow_trends posts get their own layout instead of raw text + link.
  const trend = post?.is_bot ? parseTrend(post.caption) : null;
  if (trend) return <TrendCard trend={trend} image={post?.photos?.[0]} />;

  // Preview the first link, but only on text posts: photos already fill the card.
  const firstUrl = findUrls(post.caption)[0];
  const showPreview = firstUrl && !(post?.photos?.length > 0);

  return (
    <div className="">
      <ExpandableText text={post?.caption} />
      {post?.game ? (
        <GameCard game={post.game} />
      ) : post?.poll ? (
        <PollView postId={post.id} poll={post.poll} />
      ) : (
        showPreview && <LinkPreview url={firstUrl} />
      )}
    </div>
  );
};

export default PostCaptions;
