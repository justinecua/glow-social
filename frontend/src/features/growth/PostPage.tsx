import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileX } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import PhotoDialog from "@/features/dashboard/components/modal/PhotoDialog";
import SkeletonPost from "@/features/dashboard/components/Skeleton/skeletonPosts";
import PostComments from "@/features/dashboard/components/Feed/PostComments";
import PostCard from "@/features/discover/components/PostCard";
import { useLivePost } from "@/features/posts/livePosts";
import { EmptyState } from "@/features/discover/components/PageHeader";
import { useGetPostQuery } from "@/redux/services/growth";
import { useStoredUser } from "@/utils/auth";
import { formatCount } from "@/lib/formatCount";

/** /post/:id: where shared links land. */
const PostPage = () => {
  const { id = "" } = useParams();
  const user = useStoredUser();
  const { data, isLoading, isError } = useGetPostQuery({ post_id: id });
  // Reflects edits from the ⋯ menu; becomes null once deleted here.
  const post = useLivePost(data);
  const [viewer, setViewer] = useState<number | null>(null);

  return (
    <AppShell>
      <div className="w-full max-w-xl pt-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>

        {isLoading ? (
          <SkeletonPost />
        ) : isError || !post ? (
          <EmptyState
            icon={<FileX className="h-5 w-5" />}
            title="This post isn't available"
            text="It may have been deleted."
          />
        ) : (
          <>
            <PostCard post={post} onPhotoClick={(i) => setViewer(i)} />

            <section className="rounded-xl bg-[var(--home-card)]">
              <h2 className="border-b px-4 py-3 text-sm font-semibold">
                Comments ({formatCount(post.comment_count)})
              </h2>
              <PostComments post={post} canReply={false} />
            </section>

            {!user && (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-xl bg-[var(--home-card)] p-6 text-center">
                <p className="font-semibold">Join the conversation on Glow</p>
                <div className="flex gap-2">
                  <Button asChild className="bg-[var(--button-color-bg)] text-white hover:opacity-90">
                    <Link to="/register">Create account</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/login">Log in</Link>
                  </Button>
                </div>
              </div>
            )}

            <PhotoDialog
              isOpen={viewer !== null}
              setIsOpen={(o) => !o && setViewer(null)}
              photos={post.photos ?? []}
              selectedIndex={viewer ?? 0}
            />
          </>
        )}
      </div>
    </AppShell>
  );
};

export default PostPage;
