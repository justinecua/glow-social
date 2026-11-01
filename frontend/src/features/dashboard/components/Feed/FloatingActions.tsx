import { useStoredUser } from "@/utils/auth";
import CreatePostDialog from "../modal/CreatePostDialog";
import { LogOut, MessageCircleMore, Pencil, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import LogoutConfirmDialog from "@/components/layout/LogoutConfirmDialog";
import { Avatar } from "@/features/discover/components/PersonRow";

const FloatingActions = ({ refetchPosts }) => {
  const dialogRef = useRef();
  const user = useStoredUser();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!user) return null;

  return (
    <>
      <CreatePostDialog ref={dialogRef} onPostCreated={refetchPosts} />
      <LogoutConfirmDialog open={confirmLogout} onOpenChange={setConfirmLogout} />

      <div className="xl:hidden lg:flex fixed bottom-20 right-4 sm:right-6 z-50 flex flex-col items-end gap-3">
        <div className="relative group">
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className={`p-3 sm:p-4 bg-[var(--home-card)] cursor-pointer hover:bg-[var(--button-hover-bg-color)] rounded-full shadow-xl transition-transform duration-300 group-hover:rotate-90  ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Floating Actions */}
          {isOpen && (
            <div
              className={`absolute bottom-full right-0 mb-2 flex flex-col items-center gap-2 
                transition-all duration-300
                opacity-100 visible translate-y-0`}
            >
              <button
                className="p-3 sm:p-4 bg-[var(--home-card)] cursor-pointer hover:bg-[var(--button-hover-bg-color)] rounded-full shadow-xl"
                onClick={() => dialogRef.current?.open()}
              >
                <Pencil className="w-5 h-5" />
              </button>

              <button className="p-3 sm:p-4 bg-[var(--home-card)] cursor-pointer hover:bg-[var(--button-hover-bg-color)] rounded-full shadow-xl">
                <MessageCircleMore className="w-5 h-5" />
              </button>

              <button
                className="p-3 sm:p-4 bg-[var(--home-card)] cursor-pointer hover:bg-[var(--button-hover-bg-color)] rounded-full shadow-xl flex items-center justify-center"
                onClick={() => setConfirmLogout(true)}
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <Link to={`/profile/${user?.user?.account_id}`}>
                <button className="cursor-pointer">
                  <Avatar
                    src={user?.user?.profile_photo}
                    alt="Your profile"
                    className="mr-2 h-10 w-10"
                  />
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FloatingActions;
