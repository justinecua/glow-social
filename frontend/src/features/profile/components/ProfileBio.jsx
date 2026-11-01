import { Link } from "react-router-dom";
import ExpandableText from "@/components/ui/custom/expandable";
import { useGetGlowWallQuery } from "@/redux/services/growth";
import { useGetTotalFriendsQuery } from "@/redux/services/accounts/accounts";
import { useGetTotalGlowsPostByUserQuery } from "@/redux/services/posts/posts";
import { formatCount } from "@/lib/formatCount";
import { useStoredUser } from "@/utils/auth";

/** "12 Glows": bold number, muted label, singular when it's 1. */
const Stat = ({ value, one, many, loading }) => (
  <>
    <span className="font-semibold text-[var(--title-color)]">
      {loading ? "…" : formatCount(value ?? 0)}
    </span>{" "}
    {Number(value) === 1 ? one : many}
  </>
);

const ProfileBio = ({ item, id }) => {
  const me = useStoredUser();
  const isOwn = !!me && String(me?.user?.account_id) === String(id);
  const { data: totalFriends, isFetching } = useGetTotalFriendsQuery({ account_id: id });
  const { data: totalGlows, isLoading } = useGetTotalGlowsPostByUserQuery({ account_id: id });
  const { data: kudos, isLoading: kudosLoading } = useGetGlowWallQuery({ account_id: Number(id) });
  const hasBio = item?.bio && item.bio !== "None";

  return (
    <div className="px-4 sm:px-6">
      {hasBio ? (
        <div className="mt-2 max-w-2xl text-[var(--color-text)] [&>p]:mt-0">
          <ExpandableText text={item.bio} />
        </div>
      ) : (
        isOwn && (
          <p className="mt-2 text-sm text-[var(--color-subtitle)]">
            No bio yet. Tell people about yourself with <span className="font-medium">Edit profile</span>.
          </p>
        )
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-subtitle)]">
        <span>
          <Stat value={totalGlows} one="Glow" many="Glows" loading={isLoading} />
        </span>
        <Link to="?tab=glows" className="hover:underline">
          <Stat value={kudos?.count} one="Kudos" many="Kudos" loading={kudosLoading} />
        </Link>
        {isOwn ? (
          <Link to="/friends" className="hover:underline">
            <Stat value={totalFriends} one="Friend" many="Friends" loading={isFetching} />
          </Link>
        ) : (
          <span>
            <Stat value={totalFriends} one="Friend" many="Friends" loading={isFetching} />
          </span>
        )}
      </div>
    </div>
  );
};

export default ProfileBio;
