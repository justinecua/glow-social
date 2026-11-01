import { Fragment, useEffect, useRef, useState } from "react";
import { useGetPostsQuery } from "../../../redux/services/posts/posts";
import { Card, CardContent } from "@/components/ui/card";
import PostPhotos from "./Feed/PostPhotos";
import PostReactions from "./Feed/PostReactions";
import PostTopNav from "./Feed/PostTopNav";
import PostCaptions from "./Feed/PostCaptions";
import { SkeletonFeed } from "./Skeleton/skeletonPosts";
import InfiniteScroll from "react-infinite-scroll-component";
import FloatingActions from "./Feed/FloatingActions";
import PhotoDialog from "./modal/PhotoDialog";
import CreatePostDialog from "./modal/CreatePostDialog";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import WelcomeSteps from "@/features/growth/WelcomeSteps";
import DailyPromptCard from "@/features/growth/DailyPromptCard";
import CaughtUpCard from "@/features/growth/CaughtUpCard";

const LIMIT = 7;

const NewsFeedMiddle = () => {
  const user = useStoredUser() as any;
  const accountId = user?.user?.account_id;
  const [offset, setOffset] = useState(0);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  // Wait until we know who's signed in: the feed order depends on it
  // (friends first), so fetching as a visitor first would reshuffle it.
  const checking = useAuthChecking();
  const { data, isFetching, refetch } = useGetPostsQuery(
    { offset, limit: LIMIT },
    { skip: checking }
  );

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const createRef = useRef<any>(null);

  const handlePhotoClick = (post: any, index: number) => {
    setSelectedPhotoIndex(index);
    setSelectedPost(post);
    setDialogOpen(true);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    // Append each new page, skipping posts we already have.
    if (data?.results) {
      setAllPosts((prev) => {
        const newPosts = data.results.filter(
          (newItem: any) => !prev.some((existing) => existing.id === newItem.id)
        );
        return [...prev, ...newPosts];
      });
    }
  }, [data]);

  const refetchPosts = (newPost?: any) => {
    if (newPost) {
      setAllPosts((prev) => [{ ...newPost, is_fresh: true }, ...prev]);
    } else {
      refetch();
    }
  };

  const fetchMorePosts = () => {
    if (!isFetching) {
      setOffset((prev) => prev + LIMIT);
    }
  };

  const renderSkeletons = () => <SkeletonFeed count={3} />;

  const hasMore = data?.results?.length >= LIMIT;
  // Show "You're all caught up" right before the first older post (or at
  // the end of the feed if everything loaded is new).
  const firstOldIndex = allPosts.findIndex((p) => p.is_fresh === false);
  const showCaughtUpAtEnd = firstOldIndex === -1 && !hasMore && allPosts.length > 0;

  const openCreate = (prompt?: { text: string; tag: string }) =>
    createRef.current?.open(prompt ? { prompt } : undefined);

  return (
    <div className="Middle ft w-full max-w-xl h-full">
      {user && <CreatePostDialog ref={createRef} onPostCreated={refetchPosts} />}

      <PhotoDialog
        isOpen={isDialogOpen}
        setIsOpen={setDialogOpen}
        photos={selectedPost?.photos || []}
        selectedIndex={selectedPhotoIndex}
      />

      <div className="pt-3">
        {user && accountId && (
          <WelcomeSteps accountId={accountId} onCreatePost={() => openCreate()} />
        )}
        <DailyPromptCard signedIn={!!user} onAnswer={(p) => openCreate(p)} />
      </div>

      {allPosts.length === 0 && (isFetching || checking) && renderSkeletons()}

      <InfiniteScroll
        dataLength={allPosts.length}
        next={fetchMorePosts}
        hasMore={hasMore}
        loader={<>{renderSkeletons()}</>}
        scrollThreshold={0.9}
      >
        {allPosts.map((post, index) => (
          <Fragment key={post.id}>
            {index === firstOldIndex && <CaughtUpCard hadNewPosts={index > 0} />}
            <Card className="bg-[var(--home-card)] mb-3">
              <CardContent>
                <PostTopNav post={post} />
                <PostCaptions post={post} />
                <PostPhotos
                  post={post}
                  onPhotoClick={(i: number) => handlePhotoClick(post, i)}
                />
                <PostReactions item={post} isProfile={false} />
              </CardContent>
            </Card>
          </Fragment>
        ))}
        {showCaughtUpAtEnd && <CaughtUpCard hadNewPosts />}
      </InfiniteScroll>

      <FloatingActions refetchPosts={refetchPosts} />
    </div>
  );
};

export default NewsFeedMiddle;
