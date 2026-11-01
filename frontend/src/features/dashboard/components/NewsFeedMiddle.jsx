import { Fragment, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { ArrowUp } from "lucide-react";
import { receivedApi, useGetPostsQuery } from "../../../redux/services/posts/posts";
import { Avatar } from "@/features/discover/components/PersonRow";
import { Card, CardContent } from "@/components/ui/card";
import PostPhotos from "./Feed/PostPhotos";
import PostReactions from "./Feed/PostReactions";
import PostTopNav from "./Feed/PostTopNav";
import { useLivePosts } from "@/features/posts/livePosts";
import PostCaptions from "./Feed/PostCaptions";
import { SkeletonFeed } from "./Skeleton/skeletonPosts";
import InfiniteScroll from "react-infinite-scroll-component";
import FloatingActions from "./Feed/FloatingActions";
import PhotoDialog from "./modal/PhotoDialog";
import CreatePostDialog from "./modal/CreatePostDialog";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import WelcomeSteps from "@/features/growth/WelcomeSteps";
import CaughtUpCard from "@/features/growth/CaughtUpCard";
import PromptCard from "@/features/growth/PromptCard";
import SparksTimeline from "@/features/sparks/SparksTimeline";
import { useSeenTracker } from "@/features/posts/useSeenTracker";

const LIMIT = 7;
// Friends' new posts arrive instantly over the WebSocket ("posts_new").
// This slow poll only catches public posts from non-friends, and covers
// times the socket is down.
const NEW_POSTS_POLL_MS = 5 * 60_000;

const NewsFeedMiddle = () => {
  const user = useStoredUser();
  const accountId = user?.user?.account_id;
  const [offset, setOffset] = useState(0);
  // One "visit" of the feed: shuffles older posts and freezes the order while
  // you scroll. A new seed (pill tap / page load) gives a fresh mix.
  const [seed, setSeed] = useState(() => Date.now());
  const [loadedPosts, setAllPosts] = useState([]);
  // Applies edits/deletions made from the post ⋯ menu.
  const allPosts = useLivePosts(loadedPosts);
  // Wait until we know who's signed in: the feed order depends on it
  // (friends first), so fetching as a visitor first would reshuffle it.
  const checking = useAuthChecking();
  const { data, isFetching, refetch } = useGetPostsQuery(
    { offset, limit: LIMIT, seed },
    // Always refetch when the feed mounts, so posts created elsewhere appear.
    { skip: checking, refetchOnMountOrArgChange: true }
  );

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedPost, setSelectedPost] = useState(null);
  const createRef = useRef(null);
  const dispatch = useDispatch();
  // Tell the server which posts you've looked at, so next visit shows new ones.
  const trackSeen = useSeenTracker(!!accountId);

  // Posts other people shared since this visit started. They wait behind
  // the "New posts" pill instead of pushing the feed down while you read.
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (checking) return;
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await dispatch(
          receivedApi.endpoints.getNewPostsCount.initiate(
            { seed },
            { subscribe: false, forceRefetch: true }
          )
        ).unwrap();
        if (!stopped) setPending(res?.count > 0 ? res : null);
      } catch {
        /* offline or server hiccup: try again next round */
      }
    };
    const timer = window.setInterval(check, NEW_POSTS_POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    // A friend just posted: check now. Several pushes in a burst (e.g. a
    // friend posting twice) collapse into one request.
    let pushTimer = null;
    const onWs = (e) => {
      if (e.detail?.type !== "posts_new") return;
      window.clearTimeout(pushTimer);
      pushTimer = window.setTimeout(check, 1500);
    };
    window.addEventListener("glow:ws", onWs);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearTimeout(pushTimer);
      window.removeEventListener("glow:ws", onWs);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checking, seed, dispatch]);

  // Start a fresh visit: newest posts on top, new shuffle for the rest.
  const showPending = () => {
    setPending(null);
    setAllPosts([]);
    setOffset(0);
    setSeed(Date.now());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const pendingCount = pending?.count ?? 0;
  const pendingAuthors = pending?.authors ?? [];

  const handlePhotoClick = (post, index) => {
    setSelectedPhotoIndex(index);
    setSelectedPost(post);
    setDialogOpen(true);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    // Merge each fetched page into the list, skipping posts we already have.
    if (data?.results) {
      setAllPosts((prev) => {
        // First page (incl. a refetch after the cached copy rendered):
        // it's the newest, so it goes on top, followed by anything else
        // we already had. Appending would bury a fresh post at the bottom.
        if (offset === 0) {
          // Keep only posts you just created (they're newer than this visit,
          // so the server doesn't return them); the rest come from the server.
          const ids = new Set(data.results.map((p) => p.id));
          const mine = prev.filter(
            (p) => p.is_fresh && !ids.has(p.id) && String(p.account_id) === String(accountId)
          );
          return [...mine, ...data.results];
        }
        const newPosts = data.results.filter(
          (newItem) => !prev.some((existing) => existing.id === newItem.id)
        );
        return [...prev, ...newPosts];
      });
    }
  }, [data]);

  const addPost = (newPost) =>
    setAllPosts((prev) =>
      prev.some((p) => p.id === newPost.id) ? prev : [{ ...newPost, is_fresh: true }, ...prev]
    );

  const refetchPosts = (newPost) => {
    if (newPost) addPost(newPost);
    else refetch();
  };

  // Posts created from any Create button (sidebar, floating menu)
  useEffect(() => {
    const onCreated = (e) => {
      const post = e.detail;
      if (post?.id) addPost(post);
    };
    window.addEventListener("glow:post-created", onCreated);
    return () => window.removeEventListener("glow:post-created", onCreated);
  }, []);

  const fetchMorePosts = () => {
    if (!isFetching) {
      setOffset((prev) => prev + LIMIT);
    }
  };

  const renderSkeletons = () => <SkeletonFeed count={3} />;

  const hasMore = data?.results?.length >= LIMIT;
  // "You're all caught up": shown once, at the very end of the feed.
  const showCaughtUp = !hasMore && allPosts.length > 0;

  const openCreate = () => createRef.current?.open();

  return (
    <div className="Middle ft w-full max-w-xl h-full">
      {user && <CreatePostDialog ref={createRef} onPostCreated={refetchPosts} />}

      <PhotoDialog
        isOpen={isDialogOpen}
        setIsOpen={setDialogOpen}
        photos={selectedPost?.photos || []}
        selectedIndex={selectedPhotoIndex}
      />

      {pendingCount > 0 && (
        <div className="pointer-events-none sticky top-3 z-30 flex h-0 justify-center">
          <button
            type="button"
            onClick={showPending}
            className="pointer-events-auto mt-3 flex h-10 shrink-0 animate-in fade-in slide-in-from-top-2 cursor-pointer items-center gap-2.5 rounded-full bg-[var(--button-color-bg)] pl-3 pr-4 text-sm font-semibold text-white shadow-[0_6px_20px_-4px_rgba(0,0,0,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
          >
            <ArrowUp className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            <span className="flex shrink-0 -space-x-1.5">
              {pendingAuthors.slice(0, 3).map((p) => (
                <span
                  key={p.id}
                  className="block h-6 w-6 overflow-hidden rounded-full ring-2 ring-[var(--button-color-bg)]"
                >
                  <Avatar src={p.profile_photo} alt={p.username} className="h-6 w-6" />
                </span>
              ))}
            </span>
            <span className="whitespace-nowrap">
              {pendingCount > 99 ? "99+" : pendingCount} new {pendingCount === 1 ? "post" : "posts"}
            </span>
          </button>
        </div>
      )}

      <div className="pt-3">
        {user && <SparksTimeline />}
        {user && accountId && (
          <WelcomeSteps accountId={accountId} onCreatePost={() => openCreate()} />
        )}
        {user && <PromptCard onAnswer={(prompt) => createRef.current?.open({ prompt })} />}
      </div>

      {allPosts.length === 0 && (isFetching || checking) && renderSkeletons()}

      <InfiniteScroll
        dataLength={allPosts.length}
        next={fetchMorePosts}
        hasMore={hasMore}
        loader={<>{renderSkeletons()}</>}
        scrollThreshold={0.9}
      >
        {allPosts.map((post) => (
          <Fragment key={post.id}>
            <div ref={trackSeen} data-post-id={post.id}>
              <Card className="bg-[var(--home-card)] mb-3">
                <CardContent>
                  <PostTopNav post={post} />
                  <PostCaptions post={post} />
                  <PostPhotos post={post} onPhotoClick={(i) => handlePhotoClick(post, i)} />
                  <PostReactions item={post} isProfile={false} />
                </CardContent>
              </Card>
            </div>
          </Fragment>
        ))}
        {showCaughtUp && <CaughtUpCard />}
      </InfiniteScroll>

      <FloatingActions refetchPosts={refetchPosts} />
    </div>
  );
};

export default NewsFeedMiddle;
