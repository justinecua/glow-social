import ExpandableText from "@/components/ui/custom/expandable";
import LinkPreview, { findUrls } from "@/features/posts/LinkPreview";

const PostCaptions = ({ post }) => {
  if (!post?.caption) return null;

  // Preview the first link, but only on text posts: photos already fill the card.
  const firstUrl = findUrls(post.caption)[0];
  const showPreview = firstUrl && !(post?.photos?.length > 0);

  return (
    <div className="">
      <ExpandableText text={post?.caption} />
      {showPreview && <LinkPreview url={firstUrl} />}
    </div>
  );
};

export default PostCaptions;
