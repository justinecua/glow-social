import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Loader2, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AUDIENCES } from "@/features/growth/audience";
import { useDeletePostMutation, useUpdatePostMutation } from "@/redux/services/posts/posts";
import { postDeleted, postEdited } from "@/redux/slices/postEditsSlice";
import { useStoredUser } from "@/utils/auth";

const MAX = 800;
const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-[var(--button-hover-bg-color)]";

/** ⋯ on a post: Edit / Delete. Only shown to the post's author. */
const PostMenu = ({ post }) => {
  const user = useStoredUser();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dispatch = useDispatch();
  const [deletePost, { isLoading: deleting }] = useDeletePostMutation();

  if (!post?.id || !user?.user?.account_id || user.user.account_id !== post.account_id) return null;

  const remove = async () => {
    try {
      await deletePost({ post_id: post.id }).unwrap();
      setConfirmOpen(false);
      dispatch(postDeleted(post.id));
      toast.success("Post deleted");
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't delete the post.");
    }
  };

  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Post options"
            title="Post options"
            className="ml-auto flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-subtitle)] hover:bg-[var(--photo-bg)] hover:text-[var(--title-color)] data-[state=open]:bg-[var(--photo-bg)]"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenu.Trigger>
        {/* No Portal: the post header also appears inside the post modal,
            where a portalled menu would fight the dialog's focus trap. */}
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          className="z-[300] min-w-[150px] rounded-lg border bg-[var(--home-card)] p-1 shadow-lg"
        >
          <DropdownMenu.Item className={menuItem} onSelect={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit post
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={`${menuItem} text-red-500`}
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete post
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      {editOpen && <EditPostDialog post={post} onClose={() => setEditOpen(false)} />}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-[var(--home-card)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              Its photos, comments and glows will be removed too. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              disabled={deleting}
              className="cursor-pointer bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/** Edit the caption and who can see the post. Photos stay as they are. */
const EditPostDialog = ({ post, onClose }) => {
  const dispatch = useDispatch();
  const [updatePost, { isLoading: saving }] = useUpdatePostMutation();
  const [caption, setCaption] = useState(post.caption ?? "");
  const [audience, setAudience] = useState(post.audience || "public");
  const textareaRef = useRef(null);

  const hasPhotos = (post.photos?.length ?? 0) > 0;
  const trimmed = caption.trim();
  const changed =
    trimmed !== (post.caption ?? "").trim() || audience !== (post.audience || "public");
  const canSave = changed && !saving && trimmed.length <= MAX && (trimmed.length > 0 || hasPhotos);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const save = async () => {
    if (!canSave) return;
    try {
      await updatePost({ post_id: post.id, caption: trimmed, audience }).unwrap();
      dispatch(postEdited({ id: post.id, caption: trimmed, audience }));
      toast.success("Post updated");
      onClose();
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't save your changes.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90dvh] w-[95%] max-w-[95vw] flex-col gap-0 rounded-2xl bg-[var(--home-card)] p-0 sm:w-[560px] sm:max-w-[560px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          textareaRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Edit post</DialogTitle>
        <div className="flex shrink-0 items-center justify-between px-5 pt-4">
          <p className="text-sm font-semibold text-[var(--color-subtitle)]">Edit post</p>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-2 custom-scrollbar">
          <textarea
            ref={textareaRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save();
              }
            }}
            aria-label="Post text"
            placeholder="What's glowing today?"
            rows={4}
            className="min-h-32 w-full resize-none border-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-[var(--color-subtitle)] [overflow-wrap:anywhere]"
          />

          {hasPhotos && (
            <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
              {post.photos.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg bg-[var(--photo-bg)] object-cover"
                />
              ))}
            </div>
          )}

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtitle)]">
            Who can see this
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Audience">
            {AUDIENCES.map((a) => {
              const active = a.key === audience;
              return (
                <button
                  key={a.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setAudience(a.key)}
                  title={a.description}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-[var(--button-color-bg)] bg-[color-mix(in_srgb,var(--button-color-bg)_15%,transparent)] font-medium"
                      : "hover:bg-[var(--button-hover-bg-color)]"
                  }`}
                >
                  <a.icon className="h-3.5 w-3.5" />
                  {a.label}
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t px-4 py-2.5">
          {MAX - caption.length < 100 && (
            <span
              className={`text-xs ${caption.length > MAX ? "text-red-500" : "text-[var(--color-subtitle)]"}`}
            >
              {MAX - caption.length}
            </span>
          )}
          <DialogClose asChild>
            <button
              type="button"
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium hover:bg-[var(--button-hover-bg-color)]"
            >
              Cancel
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            title="Save (⌘/Ctrl + Enter)"
            className="flex min-w-20 cursor-pointer items-center justify-center rounded-full bg-[var(--button-color-bg)] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostMenu;
