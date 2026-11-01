import { Copy, Gift, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGetMyInvitesQuery } from "@/redux/services/growth";
import { Avatar } from "@/features/discover/components/PersonRow";
import { copyText, inviteUrl, shareLink } from "./share";
import { formatCount } from "@/lib/formatCount";

const InviteDialog = ({
  open,
  onOpenChange,
  username,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
}) => {
  const { data } = useGetMyInvitesQuery(undefined, { skip: !open });
  const url = inviteUrl(username);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--home-card)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-[var(--button-color-bg)]" />
            Invite friends to Glow
          </DialogTitle>
          <DialogDescription>
            Anyone who joins with your link becomes your friend automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg border bg-[var(--photo-bg)] p-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate text-sm">{url}</span>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => copyText(url, "Invite link copied!")}
          >
            <Copy /> Copy
          </Button>
        </div>

        <Button
          className="cursor-pointer bg-[var(--button-color-bg)] text-white hover:opacity-90"
          onClick={() =>
            shareLink(url, "Join me on Glow", "I'm on Glow, come vibe with me!")
          }
        >
          <Share2 /> Share invite
        </Button>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold">
            {formatCount(data?.count)} {data?.count === 1 ? "person has" : "people have"} joined
            from your invite
          </p>
          {data?.invitees?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.invitees.slice(0, 12).map((p: any) => (
                <Avatar
                  key={p.id}
                  src={p.profile_photo}
                  alt={p.username}
                  className="h-8 w-8"
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteDialog;
