import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authApi, useLogoutMutation } from "@/redux/services/auth/auth";
import { api } from "@/redux/services/auth/token";
import { logout as clearUser } from "@/redux/slices/authSlice";

/** Logs out on the server (it reads/clears the HttpOnly cookies) and
 *  always clears local state, even if the request fails. */
export const useLogout = () => {
  const [logout, { isLoading }] = useLogoutMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout({}).unwrap();
    } catch (error) {
      console.error("Logout request failed:", error);
      toast.error("Couldn't reach the server, signed out on this device.");
    } finally {
      localStorage.removeItem("user");
      dispatch(clearUser());
      dispatch(api.util.resetApiState());
      dispatch(authApi.util.resetApiState());
      navigate("/login");
    }
  };

  return { handleLogout, isLoggingOut: isLoading };
};
