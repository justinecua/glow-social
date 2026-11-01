import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useGetInviteInfoQuery } from "@/redux/services/growth";
import { Avatar } from "@/features/discover/components/PersonRow";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { useRegisterMutation } from "@/redux/services/auth/auth";
import { MIN_AGE, TERMS_VERSION } from "@/features/legal/legalConfig";
import glow from "../../../assets/images/glow.png";

type Field = "username" | "email" | "birthday" | "password" | "accepted_terms";
type Errors = Partial<Record<Field, string>>;

const todayISO = () => new Date().toISOString().slice(0, 10);

const ageFrom = (iso: string) => {
  const b = new Date(iso + "T00:00:00");
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (
    t.getMonth() < b.getMonth() ||
    (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())
  )
    age--;
  return age;
};

// Mirrors the server rules for fast feedback; the server re-checks everything.
const validate = (f: {
  username: string;
  email: string;
  birthday: string;
  password: string;
  acceptedTerms: boolean;
}): Errors => {
  const e: Errors = {};
  if (!/^[A-Za-z0-9_.]{3,30}$/.test(f.username.trim()))
    e.username = "3–30 characters: letters, numbers, _ or .";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
    e.email = "Enter a valid email address.";
  if (!f.birthday) e.birthday = "Enter your date of birth.";
  else if (f.birthday > todayISO()) e.birthday = "Enter a valid date of birth.";
  else if (ageFrom(f.birthday) < MIN_AGE)
    e.birthday = `You must be at least ${MIN_AGE} years old to use Glow.`;
  if (f.password.length < 8) e.password = "Use at least 8 characters.";
  else if (/^\d+$/.test(f.password))
    e.password = "Password can't be only numbers.";
  if (!f.acceptedTerms)
    e.accepted_terms = "Please agree to continue.";
  return e;
};

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p className="mt-1 text-xs text-red-500">{msg}</p> : null;

const RegisterPage = () => {
  const navigate = useNavigate();
  const [register, { isLoading }] = useRegisterMutation();
  const [params] = useSearchParams();
  const invitedBy = (() => {
    const fromUrl = params.get("invite");
    if (fromUrl) return fromUrl;
    try {
      return sessionStorage.getItem("glow_invited_by") || "";
    } catch {
      return "";
    }
  })();
  const { data: inviter } = useGetInviteInfoQuery(
    { username: invitedBy },
    { skip: !invitedBy }
  );

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate({ username, email, birthday, password, acceptedTerms });
    setErrors(found);
    if (Object.keys(found).length) return;

    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        birthday,
        accepted_terms: true,
        terms_version: TERMS_VERSION,
        marketing_opt_in: false,
        ...(inviter ? { invited_by: inviter.username } : {}),
      }).unwrap();
      try {
        sessionStorage.removeItem("glow_invited_by");
      } catch {
        /* ignore */
      }
      toast.success(
        inviter
          ? `Account created! You and @${inviter.username} are now friends. Log in to say hi.`
          : "Account created! You can now log in."
      );
      navigate("/login");
    } catch (err: any) {
      const data = err?.data ?? {};
      if (data.errors) setErrors(data.errors);
      // Duplicate username/email come back as a plain message.
      if (/username/i.test(data.message ?? ""))
        setErrors((p) => ({ ...p, username: data.message }));
      else if (/email/i.test(data.message ?? ""))
        setErrors((p) => ({ ...p, email: data.message }));
      toast.error(data.message || "Something went wrong. Please try again.");
    }
  };

  const inputClass = (field: Field) =>
    `h-11 text-sm px-4 ${errors[field] ? "border-red-500" : ""}`;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md gap-5 bg-[var(--home-card)] py-8 sm:px-4">
        <CardHeader className="items-center gap-1 text-center">
          <Link to="/" className="mx-auto mb-2">
            <img src={glow} className="h-20 w-20" alt="Glow" />
          </Link>
          <CardTitle className="text-xl text-[var(--title-color)]">
            Create your account
          </CardTitle>
          <CardDescription className="text-sm">
            Glow is your place to vibe with friends
          </CardDescription>
        </CardHeader>

        <CardContent>
          {inviter && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] p-3 dark:bg-[color-mix(in_srgb,var(--button-color-bg)_22%,transparent)]">
              <Avatar src={inviter.profile_photo} alt={inviter.username} className="h-10 w-10" />
              <p className="text-sm">
                <span className="font-semibold">
                  {inviter.firstname || `@${inviter.username}`}
                </span>{" "}
                invited you to Glow. You'll be friends as soon as you join.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
            <div>
              <Input
                id="username"
                autoComplete="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={!!errors.username}
                className={inputClass("username")}
              />
              <FieldError msg={errors.username} />
            </div>

            <div>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                className={inputClass("email")}
              />
              <FieldError msg={errors.email} />
            </div>

            <div>
              {/* "Date of birth" sits inside the field like a placeholder
                  until a date is picked (date inputs can't have one). */}
              <div className="relative">
                <Input
                  id="birthday"
                  type="date"
                  autoComplete="bday"
                  aria-label="Date of birth"
                  max={todayISO()}
                  min="1900-01-01"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  aria-invalid={!!errors.birthday}
                  className={`${inputClass("birthday")} ${
                    birthday ? "" : "text-transparent focus:text-inherit"
                  }`}
                />
                {!birthday && (
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted-foreground [input:focus+&]:hidden">
                    Date of birth
                  </span>
                )}
              </div>
              <FieldError msg={errors.birthday} />
            </div>

            <div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Password (8+ characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  className={`${inputClass("password")} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <FieldError msg={errors.password} />
            </div>

            <div className="mt-1">
              <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[var(--color-subtitle)]">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--button-color-bg)]"
                  aria-invalid={!!errors.accepted_terms}
                />
                <span>
                  I'm {MIN_AGE}+ and agree to the{" "}
                  <Link
                    to="/terms"
                    target="_blank"
                    className="text-[var(--title-color)] underline-offset-2 hover:underline"
                  >
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="text-[var(--title-color)] underline-offset-2 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              <FieldError msg={errors.accepted_terms} />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-11 w-full cursor-pointer bg-[var(--button-color-bg)] text-white hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--button-text-color)] dark:hover:text-white"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-[var(--color-subtitle)]">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-[var(--title-color)] underline-offset-2 hover:underline"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>

      <div className="absolute bottom-4 left-4">
        <ModeToggle />
      </div>
    </div>
  );
};

export default RegisterPage;
