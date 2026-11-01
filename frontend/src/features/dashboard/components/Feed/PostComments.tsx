import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useGetCommentsQuery } from "@/redux/services/posts/posts";
import {
  useDeleteCommentMutation,
  useEditCommentMutation,
} from "@/redux/services/interactions/interactions";
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
import { useStoredUser } from "@/utils/auth";
import NoProfile from "@/assets/images/No-Profile.jpg";

/** Who's looking, and whose post this is (for the ⋯ menu permissions). */
const CommentCtx = createContext<{
  myId?: number;
  postOwnerId?: number;
  postId?: number;
  replyCount: (commentId: number) => number;
}>({ replyCount: () => 0 });

type Comment = {
  comment_id: number;
  comment: string;
  dateTime: string;
  parent_id: number | null;
  account_id: number;
  username: string;
  profile_photo: string;
  edited?: boolean;
};

type PostCommentsProps = {
  post: any;
  onReply?: (comment: Comment) => void;
  canReply?: boolean;
};

const fallbackAvatar = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src !== NoProfile) img.src = NoProfile;
};

const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-[var(--button-hover-bg-color)]";

/** ⋯ menu: Edit (your own comments), Delete (yours, or any on your post). */
const CommentMenu = ({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild>
      <button
        type="button"
        aria-label="Comment options"
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-subtitle)] opacity-100 transition-opacity hover:bg-[var(--photo-bg)] focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover/comment:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </DropdownMenu.Trigger>
    {/* No Portal on purpose: inside the comment modal, a portalled menu
        sits outside the dialog's focus trap, the dialog pulls focus back,
        and the menu closes the instant it opens. Rendering inline keeps it
        inside the dialog. */}
      <DropdownMenu.Content
        align="end"
        sideOffset={4}
        collisionPadding={8}
        className="z-[300] min-w-[140px] rounded-lg border bg-[var(--home-card)] p-1 shadow-lg"
      >
        {canEdit && (
          <DropdownMenu.Item className={menuItem} onSelect={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </DropdownMenu.Item>
        )}
        {canDelete && (
          <DropdownMenu.Item className={`${menuItem} text-red-500`} onSelect={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
  </DropdownMenu.Root>
);

const CommentBody = memo(
  ({
    comment,
    small = false,
    onReply,
  }: {
    comment: Comment;
    small?: boolean;
    onReply?: () => void;
  }) => {
    const { myId, postOwnerId, postId, replyCount } = useContext(CommentCtx);
    const isMine = myId != null && String(myId) === String(comment.account_id);
    const ownsPost = myId != null && String(myId) === String(postOwnerId);
    const canEdit = isMine;
    const canDelete = isMine || ownsPost;

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(comment.comment);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [editComment, { isLoading: saving }] = useEditCommentMutation();
    const [deleteComment, { isLoading: deleting }] = useDeleteCommentMutation();
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const startEdit = () => {
      setDraft(comment.comment);
      setEditing(true);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    };

    const save = async () => {
      const text = draft.trim();
      if (!text) return;
      if (text === comment.comment) return setEditing(false);
      try {
        await editComment({ comment_id: comment.comment_id, post_id: postId, comment: text }).unwrap();
        setEditing(false);
      } catch (err: any) {
        toast.error(err?.data?.message || "Couldn't save your edit.");
      }
    };

    const remove = async () => {
      try {
        await deleteComment({ comment_id: comment.comment_id, post_id: postId }).unwrap();
        toast.success("Comment deleted");
      } catch (err: any) {
        toast.error(err?.data?.message || "Couldn't delete the comment.");
      } finally {
        setConfirmOpen(false);
      }
    };

    const avatar = small ? "w-7 h-7" : "w-9 h-9";
    const replies = small ? 0 : replyCount(comment.comment_id);

    return (
      <div className="group/comment flex gap-2.5">
        <Link to={`/profile/${comment.account_id}`} className="shrink-0">
          <img
            src={comment.profile_photo || NoProfile}
            alt={comment.username}
            loading="lazy"
            decoding="async"
            className={`${avatar} rounded-full object-cover`}
            onError={fallbackAvatar}
          />
        </Link>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="rounded-2xl border bg-[var(--photo-bg)] px-3 py-2">
              <textarea
                ref={inputRef}
                value={draft}
                maxLength={255}
                rows={2}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    save();
                  }
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setEditing(false);
                  }
                }}
                aria-label="Edit comment"
                className="w-full resize-none bg-transparent text-sm outline-none [overflow-wrap:anywhere]"
              />
              <div className="mt-1 flex items-center justify-end gap-2 text-xs">
                <span className="mr-auto text-[var(--color-subtitle)]">
                  Enter to save · Esc to cancel
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="cursor-pointer rounded-md px-2 py-1 hover:bg-[var(--button-hover-bg-color)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !draft.trim()}
                  className="flex cursor-pointer items-center gap-1 rounded-md bg-[var(--button-color-bg)] px-2.5 py-1 font-semibold text-white disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-1">
              <div className="inline-block min-w-0 max-w-full rounded-2xl bg-[var(--photo-bg)] px-3 py-2">
                <Link
                  to={`/profile/${comment.account_id}`}
                  className="block text-[0.8rem] font-semibold hover:underline"
                >
                  {comment.username}
                </Link>
                <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {comment.comment}
                </p>
              </div>
              {(canEdit || canDelete) && (
                <CommentMenu
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={startEdit}
                  onDelete={() => setConfirmOpen(true)}
                />
              )}
            </div>
          )}

          {!editing && (
            <div className="mt-1 ml-3 flex items-center gap-3 text-[0.7rem] text-[var(--color-subtitle)]">
              <span>
                {comment.dateTime?.replace(/^•\s*/, "")}
                {comment.edited && " · edited"}
              </span>
              {onReply && (
                <button
                  type="button"
                  onClick={onReply}
                  className="font-semibold hover:underline cursor-pointer"
                >
                  Reply
                </button>
              )}
            </div>
          )}
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="bg-[var(--home-card)]">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
              <AlertDialogDescription>
                {replies > 0
                  ? `Its ${replies} ${replies === 1 ? "reply" : "replies"} will be deleted too. This can't be undone.`
                  : "This can't be undone."}
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
      </div>
    );
  }
);

const CommentThread = memo(
  ({
    comment,
    replies,
    onReply,
  }: {
    comment: Comment;
    replies: Comment[];
    onReply?: (c: Comment) => void;
  }) => {
    // Short threads start open; longer ones collapse behind a toggle.
    const [open, setOpen] = useState(replies.length <= 2);
    const prevCount = useRef(replies.length);

    // When a new reply lands (e.g. the user just replied), show it.
    useEffect(() => {
      if (replies.length > prevCount.current) setOpen(true);
      prevCount.current = replies.length;
    }, [replies.length]);

    return (
      <div className="px-3 py-2">
        <CommentBody
          comment={comment}
          onReply={onReply ? () => onReply(comment) : undefined}
        />

        {replies.length > 0 && (
          <div className="ml-11 mt-1">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 py-1 text-[0.75rem] font-semibold text-[var(--color-subtitle)] hover:underline cursor-pointer"
            >
              <span className="inline-block h-px w-6 bg-current opacity-60" />
              {open
                ? "Hide replies"
                : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
            </button>

            {open && (
              <div className="mt-1 flex flex-col gap-2">
                {replies.map((reply) => (
                  <CommentBody
                    key={reply.comment_id}
                    comment={reply}
                    small
                    // Replying to a reply stays in the same thread
                    onReply={onReply ? () => onReply(reply) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

const CommentsSkeleton = () => (
  <div className="flex flex-col gap-4 p-3" aria-hidden>
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex gap-2.5 animate-pulse">
        <div className="w-9 h-9 rounded-full bg-[var(--photo-bg)]" />
        <div className="flex-1">
          <div className="h-14 w-3/4 rounded-2xl bg-[var(--photo-bg)]" />
        </div>
      </div>
    ))}
  </div>
);

const PostComments = ({ post, onReply, canReply = true }: PostCommentsProps) => {
  // Cached per post: reopening a post shows its comments instantly and
  // refreshes quietly in the background if the cache is older than 30s.
  const { data, isLoading, isError } = useGetCommentsQuery(
    { post_id: post?.id },
    { skip: !post?.id, refetchOnMountOrArgChange: 30 }
  );

  const { topLevel, repliesByParent } = useMemo(() => {
    const list: Comment[] = Array.isArray(data) ? data : [];
    const top: Comment[] = [];
    const byParent = new Map<number, Comment[]>();
    for (const c of list) {
      if (c.parent_id == null) {
        top.push(c);
      } else {
        const arr = byParent.get(c.parent_id) ?? [];
        arr.push(c);
        byParent.set(c.parent_id, arr);
      }
    }
    return { topLevel: top, repliesByParent: byParent };
  }, [data]);

  const me = useStoredUser();
  const ctx = useMemo(
    () => ({
      myId: me?.user?.account_id,
      postOwnerId: post?.account_id,
      postId: post?.id,
      replyCount: (id: number) => repliesByParent.get(id)?.length ?? 0,
    }),
    [me?.user?.account_id, post?.account_id, post?.id, repliesByParent]
  );

  if (isLoading) return <CommentsSkeleton />;

  if (isError) {
    return (
      <p className="p-6 text-center text-sm text-[var(--color-subtitle)]">
        Couldn't load comments.
      </p>
    );
  }

  if (topLevel.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-[var(--color-subtitle)]">
        No comments yet. Be the first to comment.
      </p>
    );
  }

  return (
    <CommentCtx.Provider value={ctx}>
    <div className="flex flex-col py-1">
      {topLevel.map((comment) => (
        <CommentThread
          key={comment.comment_id}
          comment={comment}
          replies={repliesByParent.get(comment.comment_id) ?? []}
          onReply={canReply ? onReply : undefined}
        />
      ))}
    </div>
    </CommentCtx.Provider>
  );
};

export type { Comment };
export default PostComments;
