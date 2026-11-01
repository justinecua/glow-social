// src/components/CreatePostDialog.jsx
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { lazy, Suspense } from "react";

// Loaded on demand; emoji-picker-react is a large dependency.
const EmojiPicker = lazy(() => import("emoji-picker-react"));
import { SmilePlus, Image, Check, ChevronDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AUDIENCES, audienceInfo, type AudienceKey } from "@/features/growth/audience";
import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useTheme } from "@/components/themes/theme-provider";
import { useStoredUser } from "@/utils/auth";
import { useCreatePostMutation } from "@/redux/services/posts/posts";
import { toast } from "sonner";
import { Avatar } from "@/features/discover/components/PersonRow";

const CreatePostDialog = forwardRef(({ onPostCreated }, ref) => {
  const user = useStoredUser();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  // Set when opened from a daily prompt: shown above the box, tag added to the post
  const [prompt, setPrompt] = useState<{ text: string; tag: string } | null>(null);
  // Who can see the post; remembers your last choice on this device.
  const [audience, setAudience] = useState<AudienceKey>(() => {
    try {
      const saved = localStorage.getItem("glow_last_audience") as AudienceKey | null;
      return AUDIENCES.some((a) => a.key === saved) ? (saved as AudienceKey) : "public";
    } catch {
      return "public";
    }
  });
  const chooseAudience = (key: AudienceKey) => {
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

  const handleSubmit = async () => {
    if (!text.trim() && images.length === 0) return;

    try {
      const base64Images = await Promise.all(
        images.map((img) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                name: img.name,
                origurl: reader.result,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(img);
          });
        })
      );

      const payload = {
        accID: user?.user?.account_id,
        audience,
        caption: text,
        photos: base64Images,
        taglist: prompt?.tag ? [prompt.tag] : [],
      };

      const response = await createPost(payload).unwrap();
      toast("Post created successfully!");

      setText("");
      setImages([]);
      setPrompt(null);
      setOpen(false);
      onPostCreated?.(response);
      // Let the feed know, whichever Create button was used.
      window.dispatchEvent(new CustomEvent("glow:post-created", { detail: response }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Failed to create post:", err);
      toast.error("Failed to create post. Please try again.");
    }
  };

  useImperativeHandle(ref, () => ({
    open: (opts?: { prompt?: { text: string; tag: string } }) => {
      setPrompt(opts?.prompt ?? null);
      setOpen(true);
    },
    close: () => setOpen(false),
  }));

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
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="w-[95%] sm:w-[500px] max-w-[95vw]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <h2 className="text-lg font-bold border-b p-2">Create Post</h2>
        {prompt && (
          <div className="flex items-start justify-between gap-2 rounded-lg bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] px-3 py-2 text-sm dark:bg-[color-mix(in_srgb,var(--button-color-bg)_22%,transparent)]">
            <span>
              <span className="font-semibold">Today's prompt:</span> {prompt.text}
              {prompt.tag && (
                <span className="ml-1 text-[var(--color-subtitle)]">#{prompt.tag}</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setPrompt(null)}
              className="cursor-pointer text-xs text-[var(--color-subtitle)] hover:underline"
            >
              Remove
            </button>
          </div>
        )}
        <div className="flex items-center">
          <Avatar
            src={user?.user?.profile_photo}
            alt={user?.user?.username ?? ""}
            className="mr-2 h-10 w-10"
          />
          <div className="flex flex-col items-start gap-1">
            <p className="text-sm font-medium">{user?.user?.username}</p>
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 rounded-md bg-[var(--photo-bg)] px-2 py-1 text-xs font-medium hover:bg-[var(--button-hover-bg-color)]"
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
                sideOffset={4}
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
                    {a.key === audience && <Check className="h-4 w-4 text-[var(--button-color-bg)]" />}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`What do you have in mind today, ${user?.user?.username}?`}
          className="w-full h-36 resize-none bg-transparent border-none outline-none focus:outline-none shadow-none rounded-md text-white placeholder:text-gray-400"
        />

        {images.length > 0 && (
          <div className="flex gap-3 mt-2 overflow-x-auto pb-2">
            {images.map((img, index) => (
              <div
                key={index}
                className="relative min-w-[6rem] h-24 flex-shrink-0"
              >
                <img
                  src={URL.createObjectURL(img)}
                  alt=""
                  className="object-cover w-full h-full rounded-md"
                />
                <button
                  onClick={() =>
                    setImages((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-between items-center mt-3 gap-2 relative">
          <div ref={emojiPickerRef} className="relative">
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 sm:left-70 mb-8 z-5">
                <Suspense fallback={null}>
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    theme={resolvedTheme === "dark" ? "dark" : "light"}
                  />
                </Suspense>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              asChild
              className="cursor-pointer hover:bg-[var(--button-hover-bg-color)] p-4 bg-[var(--home-card)] text-[var(--button-text-color)] w-full sm:w-[38%] rounded-md"
            >
              <label className="flex items-center text-sm cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    setImages((prev) => [...prev, ...files]);
                  }}
                />
                <Image className="mr-1" /> Image
              </label>
            </Button>

            <Button
              className="cursor-pointer hover:bg-[var(--button-hover-bg-color)] p-4 bg-[var(--home-card)] text-[var(--button-text-color)] w-full sm:w-[38%] rounded-md flex items-center"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
            >
              <SmilePlus className="mr-1" /> Emoji
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="cursor-pointer hover:bg-[var(--button-hover-bg-color)] p-4 bg-[var(--home-card)] text-[var(--button-text-color)] w-full sm:w-[50%] rounded-md flex items-center"
            >
              {isLoading ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default CreatePostDialog;
