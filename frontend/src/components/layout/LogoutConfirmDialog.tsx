import { Loader2, LogOut } from "lucide-react";
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
import { useLogout } from "./useLogout";

/** "Log out of Glow?" confirmation used by every Logout button. */
const LogoutConfirmDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { handleLogout, isLoggingOut } = useLogout();

  return (
    <AlertDialog open={open} onOpenChange={(o) => !isLoggingOut && onOpenChange(o)}>
      <AlertDialogContent className="bg-[var(--home-card)] sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Log out of Glow?</AlertDialogTitle>
          <AlertDialogDescription>
            You can log back in anytime with your username and password.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={isLoggingOut}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // keep the dialog open while logging out
              handleLogout();
            }}
            disabled={isLoggingOut}
            className="cursor-pointer bg-[var(--button-color-bg)] text-white hover:opacity-90"
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Log out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LogoutConfirmDialog;
