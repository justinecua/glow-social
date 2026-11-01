import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Send, SmilePlus, X } from "lucide-react";
import { toast } from "sonner";
import PostTopNav from "../Feed/PostTopNav";
import PostCaptions from "../Feed/PostCaptions";
import PostPhotos from "../Feed/PostPhotos";
import PostComments from "../Feed/PostComments";
import { useStoredUser } from "@/utils/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/themes/theme-provider";
import { useAddCommentMutation } from "@/redux/services/interactions/interactions";
import { useCommentCount } from "../../hooks/useCommentCount";
import NoProfile from "@/assets/images/No-Profile.jpg";
import { formatCount } from "@/lib/formatCount";

// emoji-picker-react is large; only download it when the picker is opened.
const EmojiPicker = lazy(() => import("emoji-picker-react"));

const CommentModal = ({ open, onClose, post }) => {
  const user = useStoredUser();
  const hasPhotos = post?.photos?.length > 0;
  const commentCount = useCommentCount(post);
  const { resolvedTheme } = useTheme();
  const [addComment, { isLoading: isSending }] = useAddCommentMutation();

  const [comment, setComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const inputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const listRef = useRef(null);

  // Start every open in a clean state (no leftover reply target / picker).
  useEffect(() => {
    if (!open) {
      setReplyingTo(null);
      setShowEmojiPicker(false);
    }
  }, [open]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const handleReply = useCallback((target) => {
    setReplyingTo(target);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const text = comment.trim();
    if (!text || isSending || !user) return;

    const target = replyingTo;
    try {
      await addComment({
        accID: user?.user?.account_id,
        postId: post?.id,
        comment: text,
        ...(target ? { parentId: target.comment_id } : {}),
      }).unwrap();

      setComment("");
      setReplyingTo(null);
      setShowEmojiPicker(false);

      // New top-level comments go to the bottom; bring them into view.
      if (!target) {
        requestAnimationFrame(() =>
          listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth",
          })
        );
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
      toast.error("Failed to add comment. Please try again.");
    }
  };

  const postSection = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <PostTopNav post={post} />
        </div>
        <DialogClose asChild>
          <button
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-[var(--photo-bg)] hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogClose>
      </div>
      <PostCaptions post={post} />
    </>
  );

  const commentsPanel = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center border-b px-4 py-3">
        <h2 className="text-[15px] font-semibold">Comments ({formatCount(commentCount)})</h2>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar"
      >
        <PostComments post={post} onReply={handleReply} canReply={!!user} />
      </div>

      {user && (
        <form
          onSubmit={handleSubmit}
          className="relative shrink-0 border-t bg-[var(--home-card)] px-4 py-3"
        >
          {replyingTo && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-[var(--photo-bg)] px-3 py-1.5 text-xs">
              <span className="truncate">
                Replying to <span className="font-semibold">@{replyingTo.username}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="ml-2 cursor-pointer text-muted-foreground hover:text-foreground"
                aria-label="Cancel reply"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <img
              className="h-9 w-9 shrink-0 rounded-full object-cover"
              src={user?.user?.profile_photo || NoProfile}
              onError={(e) => {
                if (e.currentTarget.src !== NoProfile) e.currentTarget.src = NoProfile;
              }}
              alt=""
            />
            <Input
              ref={inputRef}
              type="text"
              className="flex-1 p-4 text-sm"
              placeholder={replyingTo ? `Reply to @${replyingTo.username}` : "Add a comment"}
              value={comment}
              maxLength={255}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              aria-label="Add emoji"
            >
              <SmilePlus />
            </Button>
            <Button
              type="submit"
              variant="outline"
              className="cursor-pointer"
              disabled={!comment.trim() || isSending}
              aria-label="Send"
            >
              {isSending ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </div>

          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="absolute bottom-full right-4 z-[200] mb-2">
              <Suspense
                fallback={
                  <div className="flex h-[450px] w-[350px] items-center justify-center rounded-lg border bg-[var(--home-card)]">
                    <Loader2 className="animate-spin" />
                  </div>
                }
              >
                <EmojiPicker
                  onEmojiClick={(emojiData) => setComment((prev) => prev + emojiData.emoji)}
                  theme={resolvedTheme === "dark" ? "dark" : "light"}
                  lazyLoadEmojis
                />
              </Suspense>
            </div>
          )}
        </form>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Esc cancels an in-progress reply / emoji picker before closing.
        onEscapeKeyDown={(e) => {
          // Esc while editing a comment cancels the edit, not the modal.
          const el = document.activeElement;
          if (el?.getAttribute("aria-label") === "Edit comment") {
            e.preventDefault();
            return;
          }
          if (showEmojiPicker) {
            e.preventDefault();
            setShowEmojiPicker(false);
          } else if (replyingTo) {
            e.preventDefault();
            setReplyingTo(null);
          }
        }}
        // Fixed size per layout so the modal never resizes while photos and
        // comments load in.
        className={`grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden rounded-lg bg-[var(--home-card)] p-0 ${
          hasPhotos
            ? "h-[92vh] w-[95vw] max-w-[95vw] sm:max-w-[95vw] lg:h-[85vh] xl:max-w-[1200px]"
            : "max-h-[85vh] w-[95vw] max-w-[95vw] sm:max-w-[560px]"
        }`}
      >
        <DialogTitle className="sr-only">Post by {post?.username ?? "user"}</DialogTitle>
        <DialogDescription className="sr-only">Post details and comments</DialogDescription>

        {hasPhotos ? (
          <div className="flex h-full min-h-0 flex-col lg:flex-row">
            <div className="flex max-h-[45%] min-h-0 flex-col p-4 lg:max-h-none lg:flex-1">
              {postSection}
              <div className="mt-3 min-h-0 flex-1">
                <PostPhotos post={post} isModal={true} />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col border-t lg:w-[420px] lg:flex-none lg:border-t-0 lg:border-l">
              {commentsPanel}
            </div>
          </div>
        ) : (
          // Text-only posts size to their content (capped at 85vh), so a
          // short post with few comments doesn't leave a tall empty box.
          <div className="flex max-h-[85vh] min-h-0 flex-col">
            <div className="max-h-[30vh] shrink-0 overflow-y-auto border-b p-4 custom-scrollbar">
              {postSection}
            </div>
            {commentsPanel}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommentModal;
