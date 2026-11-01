import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useStoredUser } from "@/utils/auth";

/** /invite/:username: send visitors to sign-up with the inviter attached.
 *  Already signed in? Go home instead. */
const InvitePage = () => {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const signedIn = !!useStoredUser();

  useEffect(() => {
    if (signedIn) {
      navigate("/", { replace: true });
      return;
    }
    try {
      // Remember the inviter in case they browse around before signing up.
      sessionStorage.setItem("glow_invited_by", username);
    } catch {
      /* storage blocked: the query param still carries it */
    }
    navigate(`/register?invite=${encodeURIComponent(username)}`, { replace: true });
  }, [navigate, username, signedIn]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="animate-spin" />
    </div>
  );
};

export default InvitePage;
