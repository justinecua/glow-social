import { toast } from "sonner";
import { API_HOST } from "@/utils/constants";

/** Link with a preview card (served by the backend, then redirects to the app). */
export const postShareUrl = (postId) => `${API_HOST}/share/post/${postId}/`;

export const inviteUrl = (username) =>
  `${window.location.origin}/invite/${encodeURIComponent(username)}`;

// Fallback for when the Clipboard API isn't available (it requires HTTPS or
// localhost, so e.g. opening the site by IP over plain HTTP breaks it).
const legacyCopy = (text) => {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
};

export const copyText = async (text, okMessage = "Link copied!") => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (!legacyCopy(text)) {
      throw new Error("copy failed");
    }
    toast.success(okMessage);
    return true;
  } catch {
    if (legacyCopy(text)) {
      toast.success(okMessage);
      return true;
    }
    toast.error("Couldn't copy. Long-press the link to copy it.");
    return false;
  }
};

/** Native share sheet on phones; copies the link elsewhere. */
export const shareLink = async (url, title, text) => {
  if (navigator.share) {
    try {
      await navigator.share({ url, title, text });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return; // user closed the sheet
    }
  }
  await copyText(url);
};
