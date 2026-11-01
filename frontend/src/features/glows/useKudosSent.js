import { useGetMyGlowStatusQuery } from "@/redux/services/growth";
import { useStoredUser } from "@/utils/auth";

/** Have you already sent this person kudos in the last 24 hours?
 *  (The server allows one per person per day.) */
export const useKudosSent = (accountId) => {
  const user = useStoredUser();
  const { data } = useGetMyGlowStatusQuery(undefined, {
    skip: !user || !accountId,
  });
  return (data?.sent_to_today ?? []).map(String).includes(String(accountId));
};
