import { useSelector } from "react-redux";
import type { RootState } from "@/redux/store/store";
import { useLivePosts } from "@/features/posts/livePosts";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Flame, X } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import PhotoDialog from "../components/modal/PhotoDialog";
import SkeletonPost from "../components/Skeleton/skeletonPosts";
import {
  useGetExploreQuery,
  useGetPostsByTagQuery,
} from "@/redux/services/discover";
import PageHeader, { EmptyState } from "@/features/discover/components/PageHeader";
import PostCard from "@/features/discover/components/PostCard";
import { Avatar } from "@/features/discover/components/PersonRow";
import WeeklyGlows from "@/features/glows/WeeklyGlows";
import { formatCount } from "@/lib/formatCount";

const SectionTitle = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-subtitle)]">
    {children}
  </h2>
);

// Horizontal row: swipe/scroll without a visible scrollbar, and fade the
// right edge so a cut-off item reads as "more this way".
const scrollRow =
  "flex overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_85%,transparent)]";

const EMPTY: any[] = [];

const Explore = () => {
  const [params, setParams] = useSearchParams();
  const tag = params.get("tag") || "";
  const { data, isLoading, isError } = useGetExploreQuery(undefined);
  const { data: tagData, isFetching: tagLoading } = useGetPostsByTagQuery(
    { tag },
    { skip: !tag }
  );

  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(
    null
  );

  // Hide posts you deleted (or edited) this session right away; the server
  // cache catches up on the next load.
  const deleted = useSelector((st: RootState) => st.postEdits.deleted);
  const trending = useLivePosts<any>(data?.trending ?? EMPTY);
  const photos: { url: string; post_id: number }[] = (data?.photos ?? EMPTY).filter(
    (p: any) => !deleted[p.post_id]
  );
  const tags: { tag: string; posts: number }[] = data?.tags ?? [];
  const people = data?.people ?? [];

  const setTag = (t: string) => setParams(t ? { tag: t } : {});

  const tagPosts = useLivePosts<any>(tagData?.results ?? EMPTY);
  const postsToShow = tag ? tagPosts : trending;

  return (
    <AppShell>
      <div className="w-full max-w-xl">
        <PageHeader
          title="Explore"
          subtitle="See what's glowing in the community right now."
        />

        {tags.length > 0 && (
          <>
            <div className="-mt-4"><SectionTitle>Popular tags</SectionTitle></div>
            {/* One swipeable row instead of wrapping into a wall of chips */}
            <div className={`${scrollRow} gap-2`}>
            {tags.map(({ tag: t, posts }) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t === tag ? "" : t)}
                className={`flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${
                  t === tag
                    ? "bg-[var(--button-color-bg)] text-white"
                    : "bg-[var(--home-card)] hover:bg-[var(--button-hover-bg-color)]"
                }`}
              >
                #{t}
                <span className="opacity-60">{formatCount(posts)}</span>
              </button>
            ))}
            </div>
          </>
        )}

        {isLoading && (
          <div className="mt-6">
            <SkeletonPost />
            <SkeletonPost />
          </div>
        )}

        {isError && (
          <EmptyState
            icon={<X className="h-5 w-5" />}
            title="Couldn't load Explore"
            text="Please try again in a moment."
          />
        )}

        {!isLoading && !isError && !tag && (
          <>
            {people.length > 0 && (
              <>
                <SectionTitle>
                  People to discover
                </SectionTitle>
                <div className={`${scrollRow} gap-3 snap-x snap-mandatory`}>
                  {people.map((p: any) => (
                    <Link
                      key={p.id}
                      to={`/profile/${p.id}`}
                      className="flex w-28 shrink-0 snap-start flex-col items-center rounded-xl bg-[var(--home-card)] p-3 text-center transition-colors hover:bg-[var(--button-hover-bg-color)]"
                    >
                      <Avatar src={p.profile_photo} alt={p.username} className="h-14 w-14" />
                      <span className="mt-2 w-full truncate text-xs font-semibold">
                        {[p.firstname, p.lastname].filter(Boolean).join(" ") || p.username}
                      </span>
                      <span className="w-full truncate text-[11px] text-[var(--color-subtitle)]">
                        @{p.username}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            <WeeklyGlows />

            {photos.length > 0 && (
              <>
                <SectionTitle>
                  Recent photos
                </SectionTitle>
                <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-xl">
                  {photos.slice(0, 9).map((ph, i) => (
                    <button
                      key={`${ph.post_id}-${i}`}
                      type="button"
                      onClick={() =>
                        setViewer({ photos: photos.map((p) => p.url), index: i })
                      }
                      className="aspect-square cursor-pointer overflow-hidden bg-[var(--photo-bg)]"
                    >
                      <img
                        src={ph.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition duration-200 hover:scale-105 hover:brightness-90"
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {!isLoading && !isError && (
          <>
            <SectionTitle>
              {tag ? (
                <span className="flex items-center gap-2">
                  Posts tagged #{tag}
                  <button
                    type="button"
                    onClick={() => setTag("")}
                    className="cursor-pointer rounded-full p-0.5 hover:bg-[var(--photo-bg)]"
                    aria-label="Clear tag"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                "Trending"
              )}
            </SectionTitle>

            {tag && tagLoading ? (
              <SkeletonPost />
            ) : postsToShow.length > 0 ? (
              postsToShow.map((post: any) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPhotoClick={(index) => setViewer({ photos: post.photos, index })}
                />
              ))
            ) : (
              <EmptyState
                icon={<Flame className="h-5 w-5" />}
                title="Nothing here yet"
                text="Posts with the most glows and comments will show up here."
              />
            )}
          </>
        )}

        <PhotoDialog
          isOpen={!!viewer}
          setIsOpen={(open: boolean) => !open && setViewer(null)}
          photos={viewer?.photos ?? []}
          selectedIndex={viewer?.index ?? 0}
        />
      </div>
    </AppShell>
  );
};

export default Explore;
