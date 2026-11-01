import { useState } from "react";
// eslint-disable-next-line no-unused-vars -- used as <motion.*> in JSX
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/components/themes/theme-provider";

import glowOnOriginal from "../../../../assets/icons/glow.png";
import glowOffOriginal from "../../../../assets/icons/glow-outline.png";
import commentOnOriginal from "../../../../assets/icons/comments.png";
import commentOffOriginal from "../../../../assets/icons/comments-outline.png";
import glowOutlineBlackOriginal from "../../../../assets/icons/glow-outline-black.png";
import commentOutlineBlackOriginal from "../../../../assets/icons/comments-outline-black.png";
import LoginAlert from "../modal/LoginAlert";
import CommentModal from "../modal/CommentModal";

import { useNavigate } from "react-router-dom";
import { useStoredUser } from "@/utils/auth";
import {
  receivedApi as postsApi,
  useSendGlowMutation,
  useSendunGlowMutation,
} from "@/redux/services/posts/posts";
import { toast } from "sonner";
import { useCommentCount } from "../../hooks/useCommentCount";
import ShareMenu from "@/features/growth/ShareMenu";
import { formatCount } from "@/lib/formatCount";

const PostReactions = ({ item }) => {
  const [glowStates, setGlowStates] = useState({});
  const { resolvedTheme } = useTheme();
  const [showAlert, setShowAlert] = useState(false);
  const [showComment, setShowComment] = useState(false);
  // Only mount the modal once it has been opened, so a feed full of posts
  // doesn't carry one idle modal per post.
  const [commentModalMounted, setCommentModalMounted] = useState(false);
  const commentCount = useCommentCount(item);
  const prefetchComments = postsApi.usePrefetch("getComments");
  const navigate = useNavigate();
  const [sendGlow] = useSendGlowMutation();
  const [sendunGlow] = useSendunGlowMutation();

  const user = useStoredUser();
  const accId = user?.user?.account_id;


  let glowOn = glowOnOriginal;
  let glowOff = glowOffOriginal;
  let commentOn = commentOnOriginal;
  let commentOff = commentOffOriginal;
  let glowOutlineBlack = glowOutlineBlackOriginal;
  let commentOutBlack = commentOutlineBlackOriginal;

  if (resolvedTheme === "light") {
    glowOn = glowOnOriginal;
    glowOff = glowOutlineBlack;
    commentOn = commentOnOriginal;
    commentOff = commentOutBlack;
  }

  /*---------------------------- Like Algorithm ------------------------ */

  //case: Each post has an array of users who glows it
  //1. Get the account_id of the user from the localStorage
  //2. To check if the user glowed a post:
  //Check if that account_id exists on the glowers array in each post

  //Note: ?? means if the value on the left is null or undefined , use the value on the right -> Commented on June 10, 2025

  //sample:
  // item?.glowers?.forEach((glowerId) => {
  //   glowerId === accId ? true : false;
  // });
  //or just simply:
  //item?.glowers?.includes(accId);

  const toggleGlow = async (postId) => {
    if (!user) {
      setShowAlert(true);
      return;
    }

    const payload = {
      postId: postId,
      accID: accId,
    };

    const currentlyGlowed = glowStates[postId] ?? item?.glowers?.includes(accId);

    setGlowStates((prev) => ({
      ...prev,
      [postId]: !currentlyGlowed,
    }));

    try {
      if (currentlyGlowed) {
        const response = await sendunGlow(payload).unwrap();
        toast(response.message);
      } else {
        const response = await sendGlow(payload).unwrap();
        toast(response.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong.");
    }
  };

  const openComments = () => {
    setCommentModalMounted(true);
    setShowComment(true);
  };

  // Start loading comments as soon as the user shows intent, so they're
  // usually already there when the modal opens.
  const warmComments = () => prefetchComments({ post_id: item.id });

  const initiallyGlowed = item?.glowers?.includes(accId);
  const isGlowOn = glowStates[item.id] ?? initiallyGlowed ?? false;
  const isCommentOn = showComment;
  const glowCount =
    (item?.glow_count ?? 0) +
    (glowStates[item.id] === true && !initiallyGlowed ? 1 : 0) -
    (glowStates[item.id] === false && initiallyGlowed ? 1 : 0);

  /*---------------------------- Like Algorithm ------------------------ */

  return (
    <>
      <div className="flex gap-2 w-full">
        <motion.button
          onClick={() => toggleGlow(item.id)}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          aria-pressed={isGlowOn}
          className={`flex items-center mt-1 px-3 py-2 rounded-lg relative overflow-hidden cursor-pointer transition-[background-color,box-shadow] duration-300 ease-out
        ${
          isGlowOn
            ? "bg-[#2442de] shadow-[0_2px_13px_#2442de]"
            : "bg-[var(--photo-bg)] shadow-none"
        }`}
        >
          {/* key changes on toggle, so the icon pops once instead of pulsing forever */}
          <motion.img
            key={isGlowOn ? "on" : "off"}
            src={isGlowOn ? glowOn : glowOff}
            alt="Glow Icon"
            className="w-4 h-4"
            initial={isGlowOn ? { scale: 0.6, rotate: -20 } : false}
            animate={{ scale: [isGlowOn ? 1.35 : 1, 1], rotate: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
          <span
            className={`ml-2 relative inline-flex overflow-hidden tabular-nums ${
              isGlowOn ? "text-white" : resolvedTheme === "light" ? "text-black" : "text-[#f9f8fa]"
            }`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={glowCount}
                initial={{ y: isGlowOn ? 12 : -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: isGlowOn ? -12 : 12, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {formatCount(glowCount)}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.button>

        <button
          onClick={openComments}
          onMouseEnter={warmComments}
          onFocus={warmComments}
          onTouchStart={warmComments}
          className={`flex bg-[var(--photo-bg)] items-center mt-1 px-3 py-2 rounded-lg transition-transform duration-150 ease-out active:scale-[0.94] cursor-pointer`}
        >
          <img
            src={isCommentOn ? commentOn : commentOff}
            alt="Comment Icon"
            className="w-4.5 h-4.5 transition-transform duration-200"
          />
          <span
            className={`ml-2 ${
              isCommentOn
                ? "text-white"
                : resolvedTheme === "light"
                  ? "text-black"
                  : "text-[#f9f8fa]"
            }`}
          >
            {formatCount(commentCount)}
          </span>
        </button>

        <ShareMenu post={item} />
      </div>

      <LoginAlert
        open={showAlert}
        onClose={() => setShowAlert(false)}
        onConfirm={() => {
          setShowAlert(false);
          navigate("/login");
        }}
      />

      {commentModalMounted && (
        <CommentModal open={showComment} post={item} onClose={(val) => setShowComment(val)} />
      )}
    </>
  );
};

export default PostReactions;
