import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { ArrowLeft, Download, Loader2, Trash2 } from "lucide-react";
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
import { useStoredUser } from "@/utils/auth";
import { logout } from "@/redux/slices/authSlice";
import { api } from "@/redux/services/auth/token";
import { authApi, useGetMeQuery } from "@/redux/services/auth/auth";
import {
  useDeleteMyAccountMutation,
  useExportMyDataMutation,
} from "@/redux/services/accounts/accounts";
import LegalLinks from "@/features/legal/components/LegalLinks";

const CONFIRM_WORD = "DELETE";

const SettingsPage = () => {
  const storedUser = useStoredUser() as any;
  // The signed-in user arrives via /me after a hard refresh, so wait for it
  // before deciding the visitor is logged out.
  const { data: me, isLoading: isCheckingAuth } = useGetMeQuery(undefined);
  const user = storedUser ?? me;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [exportData, { isLoading: isExporting }] = useExportMyDataMutation();
  const [deleteAccount, { isLoading: isDeleting }] =
    useDeleteMyAccountMutation();

  const [deleteOpen, setDeleteOpen] = useState(false);
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

  return (
    <div className="min-h-screen w-full px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <h1 className="text-2xl font-bold text-[var(--title-color)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--color-subtitle)]">
          Signed in as @{username}
        </p>

        <section className="mt-8 rounded-xl bg-[var(--home-card)] p-6">
          <h2 className="font-semibold">Your data</h2>
          <p className="mt-1 text-sm text-[var(--color-subtitle)]">
            Download a copy of your profile, posts, comments, glows and
            friends as a JSON file.
          </p>
          <Button
            variant="outline"
            className="mt-4 cursor-pointer"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download />
            )}
            Download my data
          </Button>
        </section>

        <section className="mt-4 rounded-xl border border-red-500/40 bg-[var(--home-card)] p-6">
          <h2 className="font-semibold text-red-500">Delete account</h2>
          <p className="mt-1 text-sm text-[var(--color-subtitle)]">
            Permanently delete your account, profile, posts, photos, comments
            and glows. This can't be undone.
          </p>
          <Button
            variant="destructive"
            className="mt-4 cursor-pointer"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 /> Delete my account
          </Button>
        </section>

        <section className="mt-4 rounded-xl bg-[var(--home-card)] p-6">
          <h2 className="font-semibold">Legal</h2>
          <LegalLinks className="mt-3 text-sm" />
        </section>
      </div>

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
