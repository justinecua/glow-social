import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useResetPasswordMutation } from "@/redux/services/auth/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { toast } from "sonner";
import glow from "../../../assets/images/glow.png";
import { Input } from "@/components/ui/input";

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();
  const token = new URLSearchParams(useLocation().search).get("token");

  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast("Passwords do not match");
      return;
    }

    try {
      const res = await resetPassword({
        token,
        new_password: newPassword,
      }).unwrap();
      setMessage(res.message || "Password reset successful.");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      const errMsg = err?.data?.message || "Failed to reset password.";
      toast(errMsg);
    }
  };

  return (
    <div className="p-5 flex items-center justify-center min-h-screen flex-col h-full w-full relative">
      <Card className="w-full max-w-sm bg-[var(--home-card)]">
        <Link to="/" className="w-full">
          <div className="relative flex items-center justify-center -mb-5">
            <img src={glow} className="w-16 h-16" alt="" />
          </div>
        </Link>
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-[var(--title-color)]">
            Reset Password
          </CardTitle>
          <CardDescription className="-mt-2">
            Input your new password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-sm p-4 w-full"
                  required
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-sm p-4 w-full"
                  required
                />
              </div>
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-2">
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-[var(--button-color-bg)] text-white p-5 -mt-3 hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--button-text-color)] dark:hover:text-white cursor-pointer"
          >
            Reset
          </Button>
        </CardFooter>
      </Card>

      <div className="absolute bottom-4 left-4">
        <ModeToggle />
      </div>
    </div>
  );
};

export default ResetPassword;
