import { useStoredUser } from "@/utils/auth";
import CreatePostDialog from "../modal/CreatePostDialog";
import { LogOut, MessageCircleMore, Pencil, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import LogoutConfirmDialog from "@/components/layout/LogoutConfirmDialog";
import { Avatar } from "@/features/discover/components/PersonRow";

const FloatingActions = ({ refetchPosts }) => {
  const dialogRef = useRef();
  const user = useStoredUser();
  // Hovering (mouse only) previews the tools; clicking/tapping pins them open.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const isOpen = hovered || pinned;
  const rootRef = useRef<HTMLDivElement>(null);

  // Tap/click anywhere else closes a pinned menu.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pinned]);

  const close = () => {
    setPinned(false);
    setHovered(false);
  };
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!user) return null;

  return (
    <>
      <CreatePostDialog ref={dialogRef} onPostCreated={refetchPosts} />
      <LogoutConfirmDialog open={confirmLogout} onOpenChange={setConfirmLogout} />

      <div className="xl:hidden lg:flex fixed bottom-20 right-4 sm:right-6 z-50 flex flex-col items-end gap-3">
        <div
          ref={rootRef}
          className="relative group"
          onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
        >
          <button
            aria-label={isOpen ? "Close actions" : "Open actions"}
            aria-expanded={isOpen}
            onClick={() => setPinned((prev) => !prev)}
            className={`p-3 sm:p-4 bg-[var(--home-card)] cursor-pointer hover:bg-[var(--button-hover-bg-color)] rounded-full shadow-xl transition-transform duration-300 group-hover:rotate-90  ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Floating Actions */}
          {isOpen && (
            <div
              className={`absolute bottom-full right-0 pb-2 flex flex-col items-center gap-2 
                transition-all duration-300
                opacity-100 visible translate-y-0`}
            >
              <button
                className="p-3 sm:p-4 bg-[var(--home-card)] cursor-pointer hover:bg-[var(--button-hover-bg-color)] rounded-full shadow-xl"
                onClick={() => {
                  close();
                  dialogRef.current?.open();
                }}
                aria-label="Create post"
              >
                <Pencil className="w-5 h-5" />
              </button>

              <Link
                to="/messages"
                onClick={close}
                aria-label="Messages"
                className="p-3 sm:p-4 bg-[var(--home-card)] cursor-pointer hover:bg-[var(--button-hover-bg-color)] rounded-full shadow-xl"
              >
                <MessageCircleMore className="w-5 h-5" />
              </Link>

              <button
                className="p-3 sm:p-4 bg-[var(--home-card)] cursor-pointer hover:bg-[var(--button-hover-bg-color)] rounded-full shadow-xl flex items-center justify-center"
                onClick={() => {
                  close();
                  setConfirmLogout(true);
                }}
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <Link to={`/profile/${user?.user?.account_id}`} onClick={close} aria-label="Your profile">
                <button className="cursor-pointer">
                  <Avatar
                    src={user?.user?.profile_photo}
                    alt="Your profile"
                    className="h-10 w-10"
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
