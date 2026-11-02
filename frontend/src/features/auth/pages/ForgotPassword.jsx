import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import GlowLogo from "@/components/layout/GlowLogo";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { useForgotPasswordMutation } from "../../../redux/services/auth/auth";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast("Please input your email");
      return;
    }

    try {
      const res = await forgotPassword({ email }).unwrap();
      toast(res.message);
    } catch (err) {
      const message = err?.data?.message || "Something went wrong. Please try again";
      toast.error(message);
    }
  };

  return (
    <div className="p-5 flex items-center justify-center min-h-screen flex-col h-full w-full relative">
      <Card className="w-full max-w-sm bg-[var(--home-card)]">
        <Link to="/" className="w-full">
          <div className="relative flex items-center justify-center -mb-5">
            <GlowLogo className="h-16 w-16" />
          </div>
        </Link>
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-[var(--title-color)]">Password Reset</CardTitle>

          <CardDescription className="-mt-2">Oops, can`t remember you password?</CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Input your email"
                  className="text-sm p-4"
                />
              </div>
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-2">
          <Button
            type="submit"
            onClick={handleForgotPassword}
            disabled={isLoading}
            className="w-full bg-[var(--button-color-bg)] text-white p-5 -mt-3 hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--button-text-color)] dark:hover:text-white cursor-pointer"
          >
            Send Email
          </Button>
        </CardFooter>
      </Card>

      <div className="absolute bottom-4 left-4">
        <ModeToggle />
      </div>
    </div>
  );
};

export default ForgotPassword;
