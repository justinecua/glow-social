import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import GlowWall from "@/features/glows/GlowWall";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PostTopNav from "@/features/dashboard/components/Feed/PostTopNav";
import PostCaptions from "@/features/dashboard/components/Feed/PostCaptions";
import PostReactions from "@/features/dashboard/components/Feed/PostReactions";
import PostPhotos from "@/features/dashboard/components/Feed/PostPhotos";
import { BookOpen, FileText, Image, MessageSquare, User } from "lucide-react";
import { Key, Edit3 } from "lucide-react";
import PhotoDialog from "@/features/dashboard/components/modal/PhotoDialog";
import { formatCount } from "@/lib/formatCount";

const ProfileTabs = ({ item, posts, allPhotos }) => {
  const [isDialogOpen, setDialogOpen] = useState(false);
  // ?tab=glows (e.g. from a glow notification) opens that tab directly
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "posts";
  const setTab = (t: string) =>
    setParams(t === "posts" ? {} : { tab: t }, { replace: true });
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);

  const totalPosts = posts.length > 1 ? "Posts" : "Post";
  const totalPhotos = allPhotos.length > 1 ? "Photos" : "Photo";
  const countThoughts = posts.filter(
    (post) => !post.photos || post.photos.length === 0
  ).length;

  const totalThoughts = countThoughts > 1 ? "Thoughts" : "Thought";
  const thoughts = posts.filter(
    (post) => !post.photos || post.photos.length === 0
  );

  const [selectedPost, setSelectedPost] = useState(null);

  const handlePhotoClick = (post, index) => {
    setSelectedPhotoIndex(index);
    setSelectedPost(post);
    setDialogOpen(true);
  };

  // Empty component
  const EmptyState = ({ icon, title, description }) => (
    <div className="flex flex-col items-center justify-center text-center ">
      <div className="p-4 mb-4 rounded-full bg-[var(--button-bg-color)] text-[var(--accent-color)]">
        {icon}
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-subtitle)] max-w-md">
        {description}
      </p>
    </div>
  );

  return (
    <Card className="bg-[var(--home-card)] border-0 p-0 w-full mt-1">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full bg-[var(--home-card)] bg-none">
          <TabsTrigger
            value="posts"
            className="
                rounded-none pt-4.5 pb-4.5 cursor-pointer
                border-0
                !bg-transparent !hover:bg-transparent
                data-[state=active]:border-b-2
                data-[state=active]:border-[var(--accent-color)]
              "
          >
            {formatCount(posts.length)} {totalPosts}
          </TabsTrigger>

          <TabsTrigger
            value="photos"
            className="
                rounded-none pt-4.5 pb-4.5 cursor-pointer
                border-0
                !bg-transparent !hover:bg-transparent
                data-[state=active]:border-b-2
                data-[state=active]:border-[var(--accent-color)]
              "
          >
            {formatCount(allPhotos.length)} {totalPhotos}
          </TabsTrigger>

          <TabsTrigger
            value="thoughts"
            className="
                rounded-none pt-4.5 pb-4.5 cursor-pointer
                border-0
                !bg-transparent !hover:bg-transparent
                data-[state=active]:border-b-2
                data-[state=active]:border-[var(--accent-color)]
              "
          >
            {formatCount(countThoughts)} {totalThoughts}
          </TabsTrigger>

          <TabsTrigger
            value="glows"
            className="
                rounded-none pt-4.5 pb-4.5 cursor-pointer
                border-0
                !bg-transparent !hover:bg-transparent
                data-[state=active]:border-b-2
                data-[state=active]:border-[var(--accent-color)]
              "
          >
            Glows
          </TabsTrigger>

          <TabsTrigger
            value="about"
            className="
                rounded-none pt-4.5 pb-4.5 cursor-pointer
                border-0
                !bg-transparent !hover:bg-transparent
                data-[state=active]:border-b-2
                data-[state=active]:border-[var(--accent-color)]
              "
          >
            About
          </TabsTrigger>
        </TabsList>

        {/* Posts Content*/}
        <TabsContent value="posts" className="mt-1">
          {posts.length > 0 ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4 mt-5">
              {posts.map((post) => (
                <div key={post.id} className="break-inside-avoid mb-4">
                  <Card className="bg-[var(--background)]">
                    <CardContent>
                      <PostTopNav post={post} />
                      <PostCaptions post={post} />
                      <PostPhotos
                        post={post}
                        isModal={false}
                        isProfile={true}
                        onPhotoClick={(index) => handlePhotoClick(post, index)}
                      />
                      <PostReactions item={post} isProfile={true} />
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-120 flex items-center justify-center">
              <EmptyState
                icon={<FileText size={24} />}
                title="No posts yet"
                description={`When ${item?.username} shares something, it will appear here`}
              />
            </div>
          )}

          <PhotoDialog
            isOpen={isDialogOpen}
            setIsOpen={setDialogOpen}
            photos={selectedPost?.photos || []}
            selectedIndex={selectedPhotoIndex}
          />
        </TabsContent>

        {/* Photos Content*/}
        <TabsContent value="photos">
          <div className="mt-5">
            {allPhotos.length > 0 ? (
              <div className="justify-center grid xl:grid-cols-6 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 gap-4">
                {allPhotos.map((photo, index) => (
                  <div
                    key={index}
                    onClick={() => handlePhotoClick(null, index)}
                  >
                    <img
                      src={photo}
                      alt=""
                      onClick={(photo) => handlePhotoClick(photo, index)}
                      className="cursor-pointer w-full h-50 object-cover rounded-md hover:brightness-55 transition"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-120 flex justify-center">
                <EmptyState
                  icon={<Image size={24} />}
                  title="No photos yet"
                  description={`${item?.username} haven't uploaded any images`}
                />
              </div>
            )}
          </div>

          <PhotoDialog
            isOpen={isDialogOpen}
            setIsOpen={setDialogOpen}
            photos={allPhotos}
            selectedIndex={selectedPhotoIndex}
          />
        </TabsContent>

        {/* Thoughts Content*/}
        <TabsContent value="thoughts" className="mt-1">
          {thoughts.length > 0 ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4 mt-5">
              {thoughts.map((thought, index) => (
                <div key={index} className="break-inside-avoid mb-4">
                  <Card className="bg-[var(--background)] ">
                    <CardContent>
                      <PostTopNav post={thought} />
                      <PostCaptions post={thought} />
                      <PostPhotos
                        post={thought}
                        isModal={false}
                        isProfile={true}
                      />
                      <PostReactions item={thought} isProfile={false} />
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-120">
              <EmptyState
                icon={<MessageSquare size={24} />}
                title="No thoughts yet"
                description={`Ideas and reflections shared by ${item?.username} will appear here`}
              />
            </div>
          )}
        </TabsContent>

        {/* Glow Wall */}
        <TabsContent value="glows">
          <GlowWall profile={item} />
        </TabsContent>

        {/* About Content */}
        <TabsContent value="about" className="mt-5">
          {item ? (
            <div className="grid gap-6">
              {/* Basic Info Card */}
              <div className="p-6 bg-[var(--background)] rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Basic Information
                </h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1">
                    <p className="text-sm text-[var(--color-subtitle)]">
                      Full Name
                    </p>
                    <p className="font-medium">
                      {item.firstname} {item.lastname}
                    </p>
                  </div>

                  {/* Username */}
                  <div className="space-y-1">
                    <p className="text-sm text-[var(--color-subtitle)]">
                      Username
                    </p>
                    <p className="font-medium">@{item.username}</p>
                  </div>

                  {/* Gender */}
                  {item.gender && (
                    <div className="space-y-1">
                      <p className="text-sm text-[var(--color-subtitle)]">
                        Gender
                      </p>
                      <p className="font-medium capitalize">{item.gender}</p>
                    </div>
                  )}

                  {/* Birthday */}
                  {item.birthday && (
                    <div className="space-y-1">
                      <p className="text-sm text-[var(--color-subtitle)]">
                        Birthday
                      </p>
                      <p className="font-medium">
                        {new Date(item.birthday).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Details Card */}
              <div className="p-6 bg-[var(--background)] rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Account Details
                </h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Email: only returned by the API to the profile owner */}
                  {item.email && (
                    <div className="space-y-1">
                      <p className="text-sm text-[var(--color-subtitle)]">
                        Email
                      </p>
                      <p className="font-medium break-all">{item.email}</p>
                    </div>
                  )}

                  {/* Joined Date */}
                  <div className="space-y-1">
                    <p className="text-sm text-[var(--color-subtitle)]">
                      Member Since
                    </p>
                    <p className="font-medium">
                      {new Date(item.date_joined).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <p className="text-sm text-[var(--color-subtitle)]">
                      Status
                    </p>
                    <p className="font-medium flex items-center gap-2">
                      {/* {item.is_online ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          Online
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                          Offline
                        </>
                      )} */}
                      <>
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        Offline
                      </>
                    </p>
                  </div>
                </div>
              </div>

              {/* Bio Section */}
              {item?.bio && item?.bio !== "None" ? (
                <div className="p-6 bg-[var(--background)] rounded-xl shadow-sm">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Bio
                  </h3>
                  <p className="text-[var(--color-text)] whitespace-pre-line">
                    {item.bio}
                  </p>
                </div>
              ) : (
                <div className="p-6 bg-[var(--background)] rounded-xl shadow-sm text-center">
                  <p className="text-[var(--color-subtitle)] flex items-center justify-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    {item.username} hasn't added a bio yet
                  </p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={<User size={24} />}
              title="Profile incomplete"
              description="User information not available"
            />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default ProfileTabs;
