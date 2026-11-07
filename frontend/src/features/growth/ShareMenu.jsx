import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ExternalLink, Link2, Share2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { copyText, postShareUrl } from "./share";

const item =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-[var(--button-hover-bg-color)]";

const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

/** Share button with a small menu: Copy link · Share via… · Open post. */
const ShareMenu = ({ post }) => {
  const navigate = useNavigate();
  const url = postShareUrl(post.code);

  const nativeShare = async () => {
    try {
      await navigator.share({
        url,
        title: `@${post?.username} on Glow`,
        text: post?.caption ? String(post.caption).slice(0, 100) : undefined,
      });
    } catch (e) {
      if (e?.name !== "AbortError") await copyText(url);
    }
  };

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Share post"
          title="Share"
          className="mt-1 flex cursor-pointer items-center rounded-lg bg-[var(--photo-bg)] px-3 py-2 transition-colors hover:bg-[var(--button-hover-bg-color)] data-[state=open]:bg-[var(--button-hover-bg-color)]"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      {/* Inline (no Portal) so it also works inside dialogs */}
      <DropdownMenu.Content
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="z-[300] min-w-[170px] rounded-lg border bg-[var(--home-card)] p-1 shadow-lg"
      >
        <DropdownMenu.Item className={item} onSelect={() => copyText(url, "Link copied!")}>
          <Link2 className="h-4 w-4" /> Copy link
        </DropdownMenu.Item>
        {canNativeShare && (
          <DropdownMenu.Item className={item} onSelect={nativeShare}>
            <Upload className="h-4 w-4" /> Share via…
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item className={item} onSelect={() => navigate(`/post/${post.code}`)}>
          <ExternalLink className="h-4 w-4" /> Open post
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};

export default ShareMenu;
