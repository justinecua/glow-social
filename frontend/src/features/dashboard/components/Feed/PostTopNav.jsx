import SparkRing from "@/features/sparks/SparkRing";
import AutomatedBadge from "@/components/ui/custom/AutomatedBadge";
import { useState } from "react";
import NoProfile from "../../../../assets/images/No-Profile.jpg";
import { Link } from "react-router-dom";
import { audienceInfo } from "@/features/growth/audience";
import PostMenu from "@/features/posts/PostMenu";
import { accountPhoto } from "@/features/posts/botAccounts";

const PostTopNav = ({ post }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex w-full min-w-0 items-center">
      <Link to={`/profile/${post?.account_id}`} className="flex items-center mr-2">
        <SparkRing accountId={post?.account_id}>
          <img
            src={imgError || !accountPhoto(post) ? NoProfile : accountPhoto(post)}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
            onError={() => setImgError(true)}
          />
        </SparkRing>
      </Link>
      <Link to={`/profile/${post?.account_id}`} className="flex items-center">
        <p className="text-[0.8rem] font-medium ">{post?.username} &nbsp;</p>{" "}
        {post?.is_bot && <AutomatedBadge className="mr-1.5" />}
      </Link>
      <p className="text-[0.8rem] text-[var(--text-color-dateTime)]"> {post?.dateTime}</p>
      {post?.audience &&
        post.audience !== "public" &&
        (() => {
          const a = audienceInfo(post.audience);
          return (
            <span
              className="ml-1.5 text-[var(--text-color-dateTime)]"
              title={`Shared with: ${a.label}`}
              aria-label={`Shared with: ${a.label}`}
            >
              <a.icon className="h-3.5 w-3.5" />
            </span>
          );
        })()}
      <PostMenu post={post} />
    </div>
  );
};

export default PostTopNav;
