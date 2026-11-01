import { useState } from "react";
import NoProfile from "../../../../assets/images/No-Profile.jpg";
import { Link } from "react-router-dom";

const PostTopNav = ({ post }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex items-center ">
      <Link
        to={`/profile/${post?.account_id}`}
        className="flex items-center mr-2"
      >
        <img
          src={imgError || !post?.profile_photo ? NoProfile : post?.profile_photo}
          alt=""
          className="w-10 h-10 rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      </Link>
      <Link to={`/profile/${post?.account_id}`} className="flex items-center">
        <p className="text-[0.8rem] font-medium ">{post?.username} &nbsp;</p>{" "}
      </Link>
      <p className="text-[0.8rem] text-[var(--text-color-dateTime)]">
        {" "}
        {post?.dateTime}
      </p>
    </div>
  );
};

export default PostTopNav;
