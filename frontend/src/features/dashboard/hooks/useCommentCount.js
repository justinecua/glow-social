import { useMemo } from "react";
import { useSelector } from "react-redux";
import { receivedApi } from "@/redux/services/posts/posts";

/**
 * Comment count for a post that stays in sync with the comments cache.
 * Once a post's comments have been loaded (or a comment was added), the
 * count comes from the cached list; otherwise it falls back to the count
 * that came with the post.
 */
export const useCommentCount = (post) => {
  const selectComments = useMemo(
    () => receivedApi.endpoints.getComments.select({ post_id: post?.id }),
    [post?.id]
  );
  const cached = useSelector((state) => selectComments(state)?.data);

  return Array.isArray(cached) ? cached.length : Number(post?.comment_count) || 0;
};
