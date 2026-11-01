import { useSelector } from "react-redux";
import { store } from "@/redux/store/store";
import { authApi } from "@/redux/services/auth/auth";

/** One-off snapshot of the signed-in user. Use only outside React components
 *  (it does NOT update when the user logs in or out). */
export function getStoredUser() {
  const state = store.getState();
  return state.auth.user || null;
}

/** The signed-in user as `{ user: {...} }`, or null. Re-renders the
 *  component when the user logs in or out. Use this inside components. */
export function useStoredUser(): any {
  return useSelector((state: any) => state.auth.user || null);
}

const selectMe = authApi.endpoints.getMe.select(undefined);

/** True while we don't yet know whether the visitor is signed in (the /me
 *  check on page load hasn't finished). Render neutral skeletons during this
 *  instead of guessing "logged out" and then flipping layouts. */
export function useAuthChecking(): boolean {
  return useSelector((state: any) => {
    if (state.auth.user) return false;
    const me = selectMe(state);
    const status = me?.status;
    if (status === undefined || status === "uninitialized" || status === "pending") return true;
    // /me succeeded but App hasn't stored the user yet (one render): still
    // "checking", so we don't flash the logged-out layout.
    return status === "fulfilled" && !!(me?.data as any)?.user;
  });
}
