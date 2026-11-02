import { Link } from "react-router-dom";
import ExpandableText from "@/components/ui/custom/expandable";
import { useGetGlowWallQuery } from "@/redux/services/growth";
import { useGetTotalFriendsQuery } from "@/redux/services/accounts/accounts";
import { useGetTotalGlowsPostByUserQuery } from "@/redux/services/posts/posts";
import { formatCount } from "@/lib/formatCount";
import { useStoredUser } from "@/utils/auth";
import { STATS } from "../design/options";

/** "12 Glows": bold number, muted label, singular when it's 1. */
const Stat = ({ value, one, many, loading }) => (
  <>
    <span className="font-semibold text-[var(--title-color)]">
      {loading ? "…" : formatCount(value ?? 0)}
    </span>{" "}
    {Number(value) === 1 ? one : many}
  </>
);

const ProfileBio = ({ item, id, design, extraStats, asVisitor = false }) => {
  const me = useStoredUser();
  const isOwn = !!me && String(me?.user?.account_id) === String(id) && !asVisitor;
  const { data: totalFriends, isFetching } = useGetTotalFriendsQuery({ account_id: id });
  const { data: totalGlows, isLoading } = useGetTotalGlowsPostByUserQuery({ account_id: id });
  const { data: kudos, isLoading: kudosLoading } = useGetGlowWallQuery({ account_id: Number(id) });
  const hasBio = item?.bio && item.bio !== "None";
  const centered = design.header_layout === "centered" || design.header_layout === "no_cover";
  const values = {
    glows: { value: totalGlows, loading: isLoading },
    kudos: { value: kudos?.count, loading: kudosLoading, to: "?tab=glows" },
    friends: { value: totalFriends, loading: isFetching, to: isOwn ? "/friends" : null },
    games: { value: extraStats?.games, loading: !extraStats },
    chain: { value: extraStats?.chain, loading: !extraStats },
  };

  return (
    <div className="px-4 sm:px-6">
      {hasBio ? (
        <div className={`mt-2 max-w-2xl text-[var(--color-text)] [&>p]:mt-0 ${centered ? "mx-auto text-center" : ""}`}>
          <ExpandableText text={item.bio} />
        </div>
      ) : (
        isOwn && (
          <p className={`mt-2 text-sm text-[var(--color-subtitle)] ${centered ? "text-center" : ""}`}>
            No bio yet. Tell people about yourself with <span className="font-medium">Edit profile</span>.
          </p>
        )
      )}

      <div
        className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-subtitle)] ${
          centered ? "justify-center" : ""
        }`}
      >
        {design.stats.map((key) => {
          const stat = <Stat value={values[key]?.value} one={STATS[key].one} many={STATS[key].many} loading={values[key]?.loading} />;
          return values[key]?.to ? (
            <Link key={key} to={values[key].to} className="hover:underline">
              {stat}
            </Link>
          ) : (
            <span key={key}>{stat}</span>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileBio;
