import { useStoredUser } from "@/utils/auth";
import { useGetCountNotificationsByUserQuery } from "@/redux/services/notifications/notifications";
import { formatCount } from "@/lib/formatCount";

/** Red badge with the number of unread notifications (live, see NotificationsRealtime). */
const NotificationsCount = () => {
  const user = useStoredUser();
  const accountId = user?.user?.account_id;
  const { data } = useGetCountNotificationsByUserQuery(
    { account_id: accountId },
    { skip: !accountId }
  );
  const n = Number(data) || 0;
  if (!n) return null;
  return (
    <span
      className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
      aria-label={`${n} unread notification${n === 1 ? "" : "s"}`}
    >
      {formatCount(n)}
    </span>
  );
};

export default NotificationsCount;
