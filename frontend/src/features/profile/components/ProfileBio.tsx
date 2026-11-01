import ExpandableText from "@/components/ui/custom/expandable";
import { Diamond, Edit3, Users } from "lucide-react";
import { useGetTotalFriendsQuery } from "@/redux/services/accounts/accounts";
import { useGetTotalGlowsPostByUserQuery } from "@/redux/services/posts/posts";
import { formatCount } from "@/lib/formatCount";

const ProfileBio = ({ item, id }) => {
  const { data: totalFriends, isFetching } = useGetTotalFriendsQuery({
    account_id: id,
  });
  const { data: totalGlows, isLoading } = useGetTotalGlowsPostByUserQuery({
    account_id: id,
  });

  return (
    <div className="flex items-center justify-between">
      <div className="ml-8 w-[55%]">
        {item?.bio && item?.bio !== "None" ? (
          <div className="text-[var(--color-text)] whitespace-pre-line">
            <ExpandableText text={item?.bio} />
          </div>
        ) : (
          <p className="text-[var(--color-subtitle)] flex items-center text-sm">
            <Edit3 className="w-4 h-4 mr-2" />
            {item?.username} hasn't added a bio yet
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-6 mt-4 md:mt-0 mr-5">
        <div className="flex flex-col items-center">
          <div className="flex items-center text-sm font-medium">
            <Diamond className="w-4 h-4 mr-1 text-[var(--accent-color)]" />{" "}
            {isLoading ? "..." : formatCount(totalGlows as any)}
          </div>
          <span className="text-sm text-[var(--color-subtitle)]">Glows</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-center text-sm font-medium">
            <Users className="w-4 h-4 mr-1 text-[var(--accent-color)]" />
            {isFetching ? "..." : formatCount(totalFriends as any)}
          </div>
          <span className="text-sm text-[var(--color-subtitle)]">Friends</span>
        </div>
      </div>
    </div>
  );
};

export default ProfileBio;
