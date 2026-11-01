import { useMemo } from "react";
import { useSelector } from "react-redux";
const selectEdits = (s) => s.postEdits;

/** A post list with this session's edits applied and deleted posts removed. */
export function useLivePosts(posts) {
  const { edited, deleted } = useSelector(selectEdits);
  return useMemo(
    () =>
      posts
        .filter((p) => !deleted[p.id])
        .map((p) => (edited[p.id] ? { ...p, ...edited[p.id] } : p)),
    [posts, edited, deleted]
  );
}

/** One post with edits applied; null once it has been deleted. */
export function useLivePost(post) {
  const { edited, deleted } = useSelector(selectEdits);
  return useMemo(() => {
    if (!post) return null;
    if (deleted[post.id]) return null;
    return edited[post.id] ? { ...post, ...edited[post.id] } : post;
  }, [post, edited, deleted]);
}
