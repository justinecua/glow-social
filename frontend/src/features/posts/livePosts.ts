import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store/store";

const selectEdits = (s: RootState) => s.postEdits;

/** A post list with this session's edits applied and deleted posts removed. */
export function useLivePosts<T extends { id: number }>(posts: T[]): T[] {
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
export function useLivePost<T extends { id: number }>(post: T | null | undefined): T | null {
  const { edited, deleted } = useSelector(selectEdits);
  return useMemo(() => {
    if (!post) return null;
    if (deleted[post.id]) return null;
    return edited[post.id] ? { ...post, ...edited[post.id] } : post;
  }, [post, edited, deleted]);
}
