import { useCallback, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { receivedApi } from "@/redux/services/posts/posts";

const VISIBLE_RATIO = 0.5;   // at least half the post on screen...
const VISIBLE_MS = 1000;     // ...for a second counts as "seen"
const FLUSH_MS = 5000;

/** Reports feed posts the user actually looked at, in small batches.
 *  Returns a ref callback to put on each post's wrapper (with data-post-id). */
export function useSeenTracker(enabled: boolean) {
  const dispatch = useDispatch<any>();
  const queue = useRef<Set<number>>(new Set());
  const sent = useRef<Set<number>>(new Set());
  const timers = useRef<Map<Element, number>>(new Map());
  const observer = useRef<IntersectionObserver | null>(null);
  const elements = useRef<Set<HTMLElement>>(new Set());

  const flush = useCallback(() => {
    const ids = [...queue.current];
    if (!ids.length) return;
    queue.current.clear();
    ids.forEach((id) => sent.current.add(id));
    dispatch(receivedApi.endpoints.markSeen.initiate(ids)).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = Number((e.target as HTMLElement).dataset.postId);
          if (!id || sent.current.has(id)) continue;
          if (e.isIntersecting) {
            if (!timers.current.has(e.target)) {
              timers.current.set(
                e.target,
                window.setTimeout(() => {
                  queue.current.add(id);
                  timers.current.delete(e.target);
                }, VISIBLE_MS)
              );
            }
          } else {
            window.clearTimeout(timers.current.get(e.target));
            timers.current.delete(e.target);
          }
        }
      },
      { threshold: VISIBLE_RATIO }
    );
    // Posts that rendered before the observer existed.
    elements.current.forEach((el) => el.isConnected && observer.current?.observe(el));
    const interval = window.setInterval(flush, FLUSH_MS);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      flush();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [enabled, flush]);

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;
    elements.current.add(el);
    observer.current?.observe(el);
  }, []);
}
