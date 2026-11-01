// src/components/CreatePostDialog.jsx
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { lazy, Suspense } from "react";

// Loaded on demand; emoji-picker-react is a large dependency.
const EmojiPicker = lazy(() => import("emoji-picker-react"));
import { SmilePlus, Image, Check, ChevronDown, ListChecks, Loader2, Plus, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AUDIENCES, audienceInfo } from "@/features/growth/audience";
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useTheme } from "@/components/themes/theme-provider";
import { useStoredUser } from "@/utils/auth";
import { useCreatePostMutation } from "@/redux/services/posts/posts";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "@/features/discover/components/PersonRow";

const CreatePostDialog = forwardRef(({ onPostCreated }, ref) => {
  const user = useStoredUser();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  // Poll: 2-4 options, shown under the text. Photos and polls don't mix.
  const [pollOn, setPollOn] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollHours, setPollHours] = useState(24);
  // Set when the composer was opened from today's prompt.
  const [prompt, setPrompt] = useState(null);
  const filledOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollValid =
    !pollOn ||
    (filledOptions.length >= 2 &&
      new Set(filledOptions.map((o) => o.toLowerCase())).size === filledOptions.length);
  const resetPoll = () => {
    setPollOn(false);
    setPollOptions(["", ""]);
    setPollHours(24);
  };
  // Who can see the post; remembers your last choice on this device.
  const [audience, setAudience] = useState(() => {
    try {
      const saved = localStorage.getItem("glow_last_audience");
      return AUDIENCES.some((a) => a.key === saved) ? saved : "public";
    } catch {
      return "public";
    }
  });
  const chooseAudience = (key) => {
    setAudience(key);
    try {
      localStorage.setItem("glow_last_audience", key);
    } catch {
      /* ignore */
    }
  };
  const current = audienceInfo(audience);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const { resolvedTheme } = useTheme();
  const [createPost, { isLoading }] = useCreatePostMutation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleSubmit = async () => {
    if (!text.trim() && images.length === 0) return;
    if (!pollValid) return;

    try {
      // Multipart upload: photos go as real files (no base64 bloat, ~25%
      // smaller); other fields as form values, nested ones as JSON.
      const payload = new FormData();
      payload.append("audience", audience);
      payload.append("caption", text);
      images.forEach((img) => payload.append("photos", img, img.name));
      payload.append("taglist", JSON.stringify(prompt ? [prompt.tag] : []));
      if (pollOn) {
        payload.append("poll", JSON.stringify({ options: filledOptions, hours: pollHours }));
      }

      const response = await createPost(payload).unwrap();
      toast("Post created successfully!");

      setText("");
      setImages([]);
      resetPoll();
      setPrompt(null);
      setOpen(false);
      onPostCreated?.(response);
      // Let the feed know, whichever Create button was used.
      window.dispatchEvent(new CustomEvent("glow:post-created", { detail: response }));
      // Created from another page: take the user to the feed to see it.
      if (pathname !== "/") navigate("/");
      else window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Failed to create post:", err);
      toast.error(err?.data?.detail || "Failed to create post. Please try again.");
    }
  };

  useImperativeHandle(ref, () => ({
    // open({ prompt }) starts an answer to today's prompt, tagged #Tag.
    open: (opts) => {
      if (opts?.prompt) {
        setPrompt(opts.prompt);
        setText((t) => (t.trim() ? t : `#${opts.prompt.tag} `));
      } else {
        setPrompt(null);
      }
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

  // One object URL per selected image. Each effect run creates its own URLs
  // and its cleanup revokes exactly those (safe under React StrictMode,
  // which runs effects twice in development).
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  const handleEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    setText((prevText) => {
      const newText = prevText.slice(0, start) + emoji + prevText.slice(end);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      }, 0);
      return newText;
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const MAX = 800; // matches the server's caption limit
  const canPost =
    (text.trim().length > 0 || images.length > 0) &&
    (!pollOn || text.trim().length > 0) &&
    pollValid &&
    text.length <= MAX &&
    !isLoading;
  const toolBtn =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--button-color-bg)] transition-colors hover:bg-[color-mix(in_srgb,var(--button-color-bg)_12%,transparent)] dark:text-white dark:hover:bg-[var(--button-hover-bg-color)]";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="flex max-h-[90dvh] w-[95%] max-w-[95vw] flex-col gap-0 rounded-2xl bg-[var(--home-card)] p-0 sm:w-[560px] sm:max-w-[560px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const t = textareaRef.current;
          t?.focus();
          if (t) t.selectionStart = t.selectionEnd = t.value.length;
        }}
      >
        <DialogTitle className="sr-only">New post</DialogTitle>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-4">
          <span className="text-sm font-semibold text-[var(--color-subtitle)]">New post</span>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </div>

        {/* Composer: avatar + writing area */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-3 custom-scrollbar">
          {prompt && (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] px-3 py-2 text-sm">
              <span className="flex-1">
                <span className="block text-xs font-medium text-[var(--button-color-bg)]">
                  Answering today's prompt
                </span>
                {prompt.text}
              </span>
              <button
                type="button"
                onClick={() => setPrompt(null)}
                aria-label="Don't answer the prompt"
                className="cursor-pointer rounded-full p-1 text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Avatar
              src={user?.user?.profile_photo}
              alt={user?.user?.username ?? ""}
              className="h-10 w-10"
            />
            <p className="min-w-0 truncate text-sm font-semibold">{user?.user?.username}</p>
          </div>
          <div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canPost) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={pollOn ? "Ask a question…" : "What's glowing today?"}
              aria-label="Post text"
              rows={previews.length || pollOn ? 2 : 4}
              className={`mt-3 w-full ${previews.length || pollOn ? "min-h-16" : "min-h-44"} resize-none border-none bg-transparent text-[15px] leading-relaxed text-foreground shadow-none outline-none placeholder:text-[var(--color-subtitle)] [overflow-wrap:anywhere]`}
            />

            {previews.length > 0 && (
              <div
                className={`mt-2 grid gap-2 ${previews.length === 1 ? "grid-cols-1" : previews.length === 2 || previews.length === 4 ? "grid-cols-2" : "grid-cols-3"}`}
              >
                {previews.map((src, index) => (
                  <div
                    key={src}
                    className={`group/img relative overflow-hidden rounded-xl bg-[var(--photo-bg)] ${
                      previews.length === 1 ? "aspect-[4/3] max-h-72 w-full" : "aspect-square"
                    }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remove photo"
                      className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pollOn && (
              <div className="mt-2 rounded-xl border p-3">
                <div className="flex flex-col gap-2">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={opt}
                        maxLength={80}
                        onChange={(e) =>
                          setPollOptions((prev) =>
                            prev.map((o, j) => (j === i ? e.target.value : o))
                          )
                        }
                        placeholder={`Option ${i + 1}`}
                        aria-label={`Option ${i + 1}`}
                        className="h-10 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-[var(--button-color-bg)]"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                          aria-label={`Remove option ${i + 1}`}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((prev) => [...prev, ""])}
                      className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 font-medium text-[var(--button-color-bg)] hover:bg-[var(--button-hover-bg-color)]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add option
                    </button>
                  )}
                  <label className="ml-auto flex items-center gap-1.5 text-[var(--color-subtitle)]">
                    Ends in
                    <select
                      value={pollHours}
                      onChange={(e) => setPollHours(Number(e.target.value))}
                      className="rounded-md border bg-transparent px-2 py-1 text-xs text-[var(--title-color)]"
                    >
                      <option value={24} className="bg-[var(--home-card)]">
                        1 day
                      </option>
                      <option value={72} className="bg-[var(--home-card)]">
                        3 days
                      </option>
                      <option value={168} className="bg-[var(--home-card)]">
                        1 week
                      </option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={resetPoll}
                    className="cursor-pointer rounded-full px-2 py-1 text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)] hover:text-red-500"
                  >
                    Remove poll
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="relative flex shrink-0 items-center gap-1 border-t px-3 py-2.5">
          <label
            className={`${toolBtn} ${pollOn ? "pointer-events-none opacity-40" : ""}`}
            title={pollOn ? "Remove the poll to add photos" : "Add photos"}
            aria-label="Add photos"
          >
            <input
              disabled={pollOn}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setImages((prev) => [...prev, ...files]);
                e.target.value = "";
              }}
            />
            <Image className="h-5 w-5" />
          </label>

          <button
            type="button"
            onClick={() => (pollOn ? resetPoll() : setPollOn(true))}
            disabled={images.length > 0}
            className={`${toolBtn} disabled:cursor-not-allowed disabled:opacity-40 ${pollOn ? "bg-[color-mix(in_srgb,var(--button-color-bg)_12%,transparent)]" : ""}`}
            title={
              images.length > 0
                ? "Remove photos to add a poll"
                : pollOn
                  ? "Remove poll"
                  : "Add a poll"
            }
            aria-label="Poll"
            aria-pressed={pollOn}
          >
            <ListChecks className="h-5 w-5" />
          </button>

          <div ref={emojiPickerRef} className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={toolBtn}
              title="Emoji"
              aria-label="Emoji"
              aria-expanded={showEmojiPicker}
            >
              <SmilePlus className="h-5 w-5" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 z-50 mb-2">
                <Suspense fallback={null}>
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    theme={resolvedTheme === "dark" ? "dark" : "light"}
                  />
                </Suspense>
              </div>
            )}
          </div>

          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="ml-1 flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-[var(--button-hover-bg-color)]"
                aria-label={`Audience: ${current.label}`}
              >
                <current.icon className="h-3.5 w-3.5" />
                {current.label}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenu.Trigger>
            {/* Inline (no Portal): it lives inside this dialog */}
            <DropdownMenu.Content
              align="start"
              side="top"
              sideOffset={6}
              collisionPadding={8}
              className="z-[300] min-w-[220px] rounded-lg border bg-[var(--home-card)] p-1 shadow-lg"
            >
              <DropdownMenu.Label className="px-2.5 py-1.5 text-xs font-semibold text-[var(--color-subtitle)]">
                Who can see this?
              </DropdownMenu.Label>
              {AUDIENCES.map((a) => (
                <DropdownMenu.Item
                  key={a.key}
                  onSelect={() => chooseAudience(a.key)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-[var(--button-hover-bg-color)]"
                >
                  <a.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">
                    <span className="block text-sm">{a.label}</span>
                    <span className="block text-xs text-[var(--color-subtitle)]">
                      {a.description}
                    </span>
                  </span>
                  {a.key === audience && (
                    <Check className="h-4 w-4 text-[var(--button-color-bg)]" />
                  )}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          <div className="ml-auto flex items-center gap-3">
            {text.length > MAX - 100 && (
              <span
                className={`text-xs tabular-nums ${text.length > MAX ? "font-semibold text-red-500" : "text-[var(--color-subtitle)]"}`}
              >
                {MAX - text.length}
              </span>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canPost}
              title="Share (⌘/Ctrl + Enter)"
              className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[var(--button-color-bg)] px-5 text-sm font-semibold text-white shadow-[0_4px_14px_color-mix(in_srgb,var(--button-color-bg)_35%,transparent)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? "Sharing" : "Share"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default CreatePostDialog;
