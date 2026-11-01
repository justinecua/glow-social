import ExpandableText from "@/components/ui/custom/expandable";

const PostCaptions = ({ post }) => {
  if (!post?.caption) return null;

  return (
    <div className="">
      <ExpandableText text={post?.caption} />
    </div>
  );
};

export default PostCaptions;
