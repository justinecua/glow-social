import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  LogOut,
  Mail,
  Shield,
  Star,
  SunMoon,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import { logout } from "@/redux/slices/authSlice";
import { api } from "@/redux/services/auth/token";
import { authApi } from "@/redux/services/auth/auth";
import {
  useDeleteMyAccountMutation,
  useExportMyDataMutation,
} from "@/redux/services/accounts/accounts";
import LogoutConfirmDialog from "@/components/layout/LogoutConfirmDialog";
import { useTheme } from "@/components/themes/theme-provider";
import { Avatar } from "@/features/discover/components/PersonRow";

/** A titled group of rows, separated by thin lines. */
const Group = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <section className="mt-6">
    {title && (
      <h2 className="mb-1 px-2 text-xs font-medium text-[var(--color-subtitle)]">{title}</h2>
    )}
    <div className="divide-y divide-[var(--border-color,rgba(127,127,127,0.15))]">{children}</div>
  </section>
);

type RowProps = {
  icon: React.ElementType;
  iconClass?: string;
  label: string;
  detail?: string;
  to?: string;
  onClick?: () => void;
  tone?: "default" | "danger";
};

/** One settings row: icon, label, optional detail, chevron when it goes somewhere. */
const Row = ({ icon: Icon, iconClass = "", label, detail, to, onClick, tone = "default" }: RowProps) => {
  const danger = tone === "danger";
  const body = (
    <>
      <Icon
        className={`h-5 w-5 shrink-0 ${danger ? "text-red-500" : "text-[var(--color-subtitle)]"} ${iconClass}`}
      />
      <span className={`flex-1 text-sm ${danger ? "text-red-500" : ""}`}>{label}</span>
      {detail && <span className="truncate text-sm text-[var(--color-subtitle)]">{detail}</span>}
      {(to || onClick) && <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-subtitle)]" />}
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left";
  const hover = " cursor-pointer hover:bg-[var(--button-hover-bg-color)]";
  if (to) return <Link to={to} className={cls + hover}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls + hover}>{body}</button>;
  return <div className={cls}>{body}</div>;
};

const CONFIRM_WORD = "DELETE";

const SettingsPage = () => {
  const storedUser = useStoredUser() as any;
  // The signed-in user arrives via /me after a hard refresh, so wait for it
  // before deciding the visitor is logged out.
  const isCheckingAuth = useAuthChecking();
  const user = storedUser;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [exportData, { isLoading: isExporting }] = useExportMyDataMutation();
  const [deleteAccount, { isLoading: isDeleting }] =
    useDeleteMyAccountMutation();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");

  if (!user && isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const username = user?.user?.username ?? user?.username ?? "account";

  const handleExport = async () => {
    try {
      const data = await exportData(undefined).unwrap();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `glow-data-${username}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } catch {
      toast.error("Couldn't export your data. Please try again.");
    }
  };

  const resetDeleteForm = (open: boolean) => {
    setDeleteOpen(open);
    if (!open) {
      setPassword("");
      setConfirmText("");
      setDeleteError("");
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    try {
      await deleteAccount({ password }).unwrap();
      localStorage.removeItem("user");
      dispatch(logout());
      dispatch(api.util.resetApiState());
      dispatch(authApi.util.resetApiState());
      toast.success("Your account has been permanently deleted.");
      navigate("/", { replace: true });
    } catch (err: any) {
      setDeleteError(
        err?.data?.detail || "Something went wrong. Please try again."
      );
    }
  };

  const me = user?.user ?? {};
  const name = [me.firstname, me.lastname].filter(Boolean).join(" ") || username;

  return (
    <div className="min-h-screen w-full px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center gap-2">
          <Link
            to="/"
            aria-label="Back to home"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold text-[var(--title-color)]">Settings</h1>
        </div>

        {/* You */}
        <Link
          to={`/profile/${me.account_id}`}
          className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-[var(--button-hover-bg-color)]"
        >
          <Avatar src={me.profile_photo} alt={username} className="h-14 w-14" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-sm text-[var(--color-subtitle)]">@{username}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--color-subtitle)]" />
        </Link>

        <Group title="Account">
          <Row icon={UserRound} label="Edit profile" to={`/profile/${me.account_id}`} />
          <Row icon={Mail} label="Email" detail={me.email || "Not set"} />
          <Row icon={Star} label="Close friends" to="/friends" />
        </Group>

        <Group title="Appearance">
          <div className="flex items-center gap-3 px-2 py-3">
            <SunMoon className="h-5 w-5 text-[var(--color-subtitle)]" />
            <span className="flex-1 text-sm">Theme</span>
            <div className="flex rounded-lg border p-0.5 text-xs">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  aria-pressed={theme === t}
                  className={`cursor-pointer rounded-md px-3 py-1 capitalize transition-colors ${
                    theme === t
                      ? "bg-[var(--button-hover-bg-color)] font-medium text-[var(--title-color)]"
                      : "text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </Group>

        <Group title="Your information">
          <Row
            icon={isExporting ? Loader2 : Download}
            iconClass={isExporting ? "animate-spin" : ""}
            label="Download your data"
            detail="JSON"
            onClick={isExporting ? undefined : handleExport}
          />
        </Group>

        <Group title="About">
          <Row icon={FileText} label="Terms of Service" to="/terms" />
          <Row icon={Shield} label="Privacy Policy" to="/privacy" />
          <Row icon={BookOpen} label="Community Guidelines" to="/guidelines" />
        </Group>

        <Group>
          <Row icon={LogOut} label="Log out" onClick={() => setLogoutOpen(true)} />
          <Row
            icon={Trash2}
            label="Delete account"
            tone="danger"
            onClick={() => setDeleteOpen(true)}
          />
        </Group>

        <p className="mt-8 px-2 pb-6 text-xs text-[var(--color-subtitle)]">
          © {new Date().getFullYear()} Glow
        </p>
      </div>

      <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />

      <Dialog open={deleteOpen} onOpenChange={resetDeleteForm}>
        <DialogContent className="bg-[var(--home-card)]">
          <form onSubmit={handleDelete} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This permanently deletes @{username} and everything you've
                posted. Consider downloading your data first.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <label htmlFor="delete-password" className="text-sm">
                Your password
              </label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label htmlFor="delete-confirm" className="mt-2 text-sm">
                Type <strong>{CONFIRM_WORD}</strong> to confirm
              </label>
              <Input
                id="delete-confirm"
                autoComplete="off"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              {deleteError && (
                <p className="text-sm text-red-500">{deleteError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => resetDeleteForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="cursor-pointer"
                disabled={
                  isDeleting || !password || confirmText !== CONFIRM_WORD
                }
              >
                {isDeleting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Delete permanently"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
