import { useGetProfileQuery } from "@/redux/services/accounts/accounts";
import { useParams } from "react-router-dom";
import { useStoredUser } from "@/utils/auth";
import { Card } from "@/components/ui/card";
import {
  useGetPostsByUserQuery,
  useLazyGetPostsByUserQuery,
} from "@/redux/services/posts/posts";
import ProfileTabs from "../components/ProfileTabs";
import { useLivePosts } from "@/features/posts/livePosts";
import ProfileName from "../components/ProfileName";
import ProfileCover from "../components/ProfileCover";
import SkeletonProfile from "@/features/dashboard/components/Skeleton/skeletonProfile";
import ProfileBio from "../components/ProfileBio";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { useTheme } from "@/components/themes/theme-provider";
import { useGetProfileDesignQuery } from "@/redux/services/profileDesign";
import DesignEditor from "../design/DesignEditor";
import ProfileBlocks from "../design/ProfileBlocks";
import { profileLook, withDefaults } from "../design/designStyle";
import { useDesignEditor } from "../design/useDesignEditor";
import { PROFILE_DESIGN_ENABLED } from "../design/options";

const EMPTY = [];

const ProfilePage = () => {
  const { id } = useParams();
  const me = useStoredUser();
  // Someone else's profile shows "Send a glow" + friend buttons: reserve them.
  const showActions = !!me && String(me?.user?.account_id) !== String(id);
  const isOwn = !!me && !showActions;
  const { resolvedTheme } = useTheme();
  const { data: published, isLoading: designLoading, isFetching: designFetching } = useGetProfileDesignQuery(id, {
    skip: !PROFILE_DESIGN_ENABLED, // when off, everyone gets the default look
  });
  const editor = useDesignEditor(id);
  const editing = editor.editing && !!editor.draft;
  const design = withDefaults(editing ? editor.draft : published?.design);
  const blockData = editing ? (editor.previewData ?? published?.blocks) : published?.blocks;
  const look = profileLook(design, resolvedTheme);
  const asVisitor = editing && editor.visitor;

  const {
    data: profile,
    isLoading,
    error,
  } = useGetProfileQuery({ profile_id: id });

  // Posts load 12 at a time. The first page is a normal cached query (it
  // refetches when you create/delete a post); older pages are appended as
  // you scroll and de-duplicated by id.
  const { data: firstPage } = useGetPostsByUserQuery({ account_id: id });
  const [fetchPage, { isFetching: loadingMore }] = useLazyGetPostsByUserQuery();
  const [older, setOlder] = useState({ id, posts: EMPTY, next: null });
  if (older.id !== id) setOlder({ id, posts: EMPTY, next: null }); // switched profile

  const next = older.posts.length ? older.next : firstPage?.next;
  const loadMore = useCallback(async () => {
    if (!next || loadingMore) return;
    try {
      const page = await fetchPage({ account_id: id, before: next }).unwrap();
      setOlder((o) =>
        o.id === id
          ? {
              id,
              posts: [...o.posts, ...(page.results ?? [])],
              next: page.next,
            }
          : o,
      );
    } catch {
      /* network hiccup: the next scroll will try again */
    }
  }, [next, loadingMore, fetchPage, id]);

  const loaded = useMemo(() => {
    const seen = new Set();
    return [...(firstPage?.results ?? EMPTY), ...older.posts].filter(
      (p) => !seen.has(p.id) && seen.add(p.id),
    );
  }, [firstPage, older.posts]);

  const posts = useLivePosts(loaded);
  const allPhotos = posts.flatMap((post) => post.photos || []);
  // Get all photos from all posts into one flat array, skipping posts with no photos (Flat array means a simple list with no nested arrays)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  if (isLoading || designLoading) {
    return (
      <div className="p-4 w-full flex flex-col items-center h-full">
        <SkeletonProfile showActions={showActions} />
      </div>
    );
  }

  if (error) return <p>Something went wrong</p>;
  if (!Array.isArray(profile)) return <p>No profile data found</p>;

  return (
    <>
      <div
        className={`pf-page flex min-h-screen w-full flex-col items-center ${look.forceDark ? "dark" : ""} ${
          editing && !asVisitor ? "md:pr-[380px]" : ""
        }`}
        data-bg={design.background}
        data-card={design.card_style}
        style={look.vars}
      >
        {profile.map((item) => (
          <div key={item.id} className="w-full sm:w-[95%] md:w-[85%] lg:w-[75%]">
            {design.background === "cover_blur" && item.cover_photo && (
              <div className="pf-blur-bg" style={{ backgroundImage: `url(${item.cover_photo})` }} aria-hidden="true" />
            )}
            <Card className="pf-card w-full flex-1 gap-0 bg-[var(--home-card)] p-2 shadow-md sm:p-3">
              <ProfileCover item={item} design={design} look={look} />
              <ProfileName
                item={item}
                id={id}
                design={design}
                look={look}
                asVisitor={asVisitor}
                onDesign={PROFILE_DESIGN_ENABLED && isOwn && !editing ? editor.start : undefined}
                designOpening={editor.opening}
              />
              <ProfileBio item={item} id={id} design={design} extraStats={published?.stats} asVisitor={asVisitor} />
              <ProfileBlocks blocks={design.blocks} data={blockData} profile={item} isOwn={isOwn && !asVisitor} />
              <ProfileTabs
                item={item}
                posts={posts}
                allPhotos={allPhotos}
                counts={firstPage?.counts}
                hasMore={!!next}
                loadingMore={loadingMore}
                onLoadMore={loadMore}
                tabOrder={design.tabs}
              />
            </Card>
          </div>
        ))}
      </div>

      {editing && !asVisitor && (
        <DesignEditor
          draft={editor.draft}
          onChange={editor.change}
          unlocks={editor.unlocks}
          posts={posts}
          allPhotos={allPhotos}
          canUndo={editor.canUndo}
          onUndo={editor.undo}
          onReset={editor.reset}
          onVisitor={() => editor.setVisitor(true)}
          onSave={editor.saveDraft}
          onPublish={editor.publish}
          onClose={editor.close}
          saving={editor.saving}
          savingAction={editor.savingAction}
          dirty={editor.dirty}
          error={editor.error}
        />
      )}
      {isOwn && designFetching && !editing && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--home-card)] px-4 py-2 text-sm font-medium shadow-lg"
        >
          <Loader2 className="h-4 w-4 animate-spin" /> Updating your profile…
        </div>
      )}
      {asVisitor && (
        <button
          type="button"
          onClick={() => editor.setVisitor(false)}
          className="fixed bottom-6 left-1/2 z-50 flex h-11 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-[var(--button-color-bg)] px-5 text-sm font-semibold text-white shadow-lg hover:opacity-90"
        >
          <Eye className="h-4 w-4" /> Back to editing
        </button>
      )}
    </>
  );
};

export default ProfilePage;
