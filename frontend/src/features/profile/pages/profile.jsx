import { useGetProfileQuery } from "@/redux/services/accounts/accounts";
import { useParams } from "react-router-dom";
import { useStoredUser } from "@/utils/auth";
import { Card } from "@/components/ui/card";
import { useGetPostsByUserQuery } from "@/redux/services/posts/posts";
import ProfileTabs from "../components/ProfileTabs";
import { useLivePosts } from "@/features/posts/livePosts";
import ProfileName from "../components/ProfileName";
import ProfileCover from "../components/ProfileCover";
import SkeletonProfile from "@/features/dashboard/components/Skeleton/skeletonProfile";
import ProfileBio from "../components/ProfileBio";
import { useEffect } from "react";

const EMPTY = [];

const ProfilePage = () => {
  const { id } = useParams();
  const me = useStoredUser();
  // Someone else's profile shows "Send a glow" + friend buttons: reserve them.
  const showActions = !!me && String(me?.user?.account_id) !== String(id);

  const { data: profile, isLoading, error } = useGetProfileQuery({ profile_id: id });

  const { data: userPosts } = useGetPostsByUserQuery({ account_id: id });

  const posts = useLivePosts(userPosts?.results ?? EMPTY);
  const allPhotos = posts.flatMap((post) => post.photos || []);
  // Get all photos from all posts into one flat array, skipping posts with no photos (Flat array means a simple list with no nested arrays)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 w-full flex flex-col items-center h-full">
        <SkeletonProfile showActions={showActions} />
      </div>
    );
  }

  if (error) return <p>Something went wrong</p>;
  if (!Array.isArray(profile)) return <p>No profile data found</p>;

  return (
    <div className=" w-full flex flex-col items-center min-h-screen">
      {profile.map((item) => (
        <Card
          key={item.id}
          className="w-full flex-1 gap-0 p-2 sm:w-[95%] sm:p-3 md:w-[85%] lg:w-[75%] bg-[var(--home-card)] shadow-md rounded-xl"
        >
          {/* Cover Page */}
          <ProfileCover item={item} />

          {/* Name Info */}
          <ProfileName item={item} id={id} />

          {/* Bio Info*/}
          <ProfileBio item={item} id={id} />

          {/* Tabs Info*/}
          <ProfileTabs item={item} posts={posts} allPhotos={allPhotos} />
        </Card>
      ))}
    </div>
  );
};

export default ProfilePage;
