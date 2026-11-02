import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  Star,
  Type,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  SPARK_BACKGROUNDS,
  useCreateSparkMutation,
} from "@/redux/services/sparks";
import { useStoredUser } from "@/utils/auth";
import { Avatar } from "@/features/discover/components/PersonRow";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

/** Share a spark: a photo with an optional caption, or words on a colour.
 *  The preview is the same card friends will see. */
const SparkComposer = ({ open, onOpenChange }) => {
  const [mode, setMode] = useState("photo");
  const [photo, setPhoto] = useState(null);
  const [text, setText] = useState("");
  const [bg, setBg] = useState("sunrise");
  const [closeOnly, setCloseOnly] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef(null);
  const [create, { isLoading }] = useCreateSparkMutation();
  const me = useStoredUser()?.user;
  // Preview the picked File without reading it into memory as base64.
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => photoUrl && URL.revokeObjectURL(photoUrl), [photoUrl]);

  useEffect(() => {
    if (!open) return;
    setMode("photo");
    setPhoto(null);
    setText("");
    setBg("sunrise");
    setCloseOnly(false);
  }, [open]);

  const pick = async (file) => {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type))
      return toast.error("Use a JPG, PNG, GIF or WebP image.");
    if (file.size > MAX_BYTES)
      return toast.error("Photos must be 8 MB or smaller.");
    setPhoto(file);
    setMode("photo");
  };

  const canShare = !isLoading && (mode === "photo" ? !!photo : !!text.trim());

  const share = async () => {
    if (!canShare) return;
    try {
      await create(
        mode === "photo"
          ? (() => {
              // Multipart: the photo goes as a real file.
              const form = new FormData();
              form.append("photo", photo, photo.name);
              form.append("text", text.trim());
              form.append("close_friends_only", String(closeOnly));
              return form;
            })()
          : {
              text: text.trim(),
              background: bg,
              close_friends_only: closeOnly,
            },
      ).unwrap();
      toast.success(
        closeOnly
          ? "Spark shared with Close Friends"
          : "Spark shared. It fades in 24 hours.",
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't share your spark. Try again.");
    }
  };

  const hasContent = mode === "photo" ? !!photo : true;
  const audience = [
    [false, "All friends", Users],
    [true, "Close friends", Star],
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-2xl border bg-[var(--home-card)] p-0 sm:max-w-[420px]">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="cursor-pointer rounded-full p-1.5 text-[var(--color-subtitle)] transition-colors hover:bg-[var(--button-hover-bg-color)] hover:text-[var(--title-color)]"
          >
            <X className="h-5 w-5" />
          </button>
          <DialogTitle className="flex-1 text-[15px] font-semibold">
            New spark
          </DialogTitle>
          <button
            type="button"
            onClick={share}
            disabled={!canShare}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-full bg-[var(--button-color-bg)] px-4 text-sm font-semibold text-white transition-[filter,transform,opacity] hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Share
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {/* Preview */}
          <div
            className={`relative aspect-[4/5] w-full overflow-hidden rounded-xl transition-shadow ${
              hasContent ? "bg-[#141414] text-white" : "bg-[var(--photo-bg)]"
            } ${dragOver ? "shadow-[0_0_0_2px_var(--button-color-bg)]" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files?.[0]);
            }}
          >
            {mode === "photo" && !photo ? (
              /* Empty: two clear ways to start */
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
                <div className="grid w-full max-w-[300px] grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border bg-[var(--home-card)] text-sm font-semibold transition-[transform,border-color] hover:-translate-y-0.5 hover:border-[var(--button-color-bg)] active:scale-95"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--button-color-bg)_14%,transparent)] text-[var(--button-color-bg)] dark:text-[#a9b8ff]">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                    Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("text")}
                    className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border bg-[var(--home-card)] text-sm font-semibold transition-[transform,border-color] hover:-translate-y-0.5 hover:border-[var(--button-color-bg)] active:scale-95"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--button-color-bg)_14%,transparent)] text-[var(--button-color-bg)] dark:text-[#a9b8ff]">
                      <Type className="h-5 w-5" />
                    </span>
                    Text
                  </button>
                </div>
                <p className="text-xs text-[var(--color-subtitle)]">
                  or drop a photo here
                </p>
              </div>
            ) : mode === "photo" ? (
              <>
                <img
                  key={photoUrl}
                  src={photoUrl}
                  alt="Your photo"
                  className="h-full w-full animate-in fade-in object-contain duration-300"
                />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  aria-label="Remove photo"
                  className="absolute right-2.5 top-2.5 cursor-pointer rounded-full bg-black/55 p-1.5 text-white backdrop-blur hover:bg-black/75"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <div
                className="flex h-full w-full items-center justify-center p-6 transition-[background] duration-300"
                style={{ background: SPARK_BACKGROUNDS[bg] }}
              >
                <textarea
                  autoFocus
                  value={text}
                  maxLength={200}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What's happening?"
                  rows={1}
                  // Grow with the text so it stays centred in the card.
                  ref={(el) => {
                    if (!el) return;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  onInput={(e) => {
                    e.currentTarget.style.height = "auto";
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  className={`max-h-full w-full resize-none overflow-hidden bg-transparent text-center text-2xl font-bold leading-tight text-white outline-none placeholder:text-white/65 ${
                    // With centred text the caret sits mid-placeholder; hide it until typing.
                    text ? "" : "caret-transparent"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setMode("photo");
                    setText("");
                  }}
                  aria-label="Back"
                  className="absolute right-2.5 top-2.5 cursor-pointer rounded-full bg-black/25 p-1.5 text-white hover:bg-black/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {/* Caption (photo) or colours (text) */}
          {mode === "photo" && photo && (
            <div className="mt-3 flex items-center gap-2.5">
              <Avatar
                src={me?.profile_photo}
                alt=""
                className="h-8 w-8 shrink-0"
              />
              <input
                value={text}
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a caption…"
                aria-label="Caption"
                className="h-9 w-full rounded-full bg-[var(--photo-bg)] px-4 text-sm outline-none placeholder:text-[var(--color-subtitle)] focus-visible:ring-2 focus-visible:ring-[var(--button-color-bg)]/40"
              />
            </div>
          )}
          {mode === "text" && (
            <div
              className="mt-3 flex justify-center gap-2"
              role="radiogroup"
              aria-label="Background colour"
            >
              {Object.entries(SPARK_BACKGROUNDS).map(([key, css]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={bg === key}
                  aria-label={key}
                  onClick={() => setBg(key)}
                  className={`h-7 w-7 cursor-pointer rounded-full transition-transform hover:scale-110 ${
                    bg === key
                      ? "ring-2 ring-[var(--title-color)] ring-offset-2 ring-offset-[var(--home-card)]"
                      : ""
                  }`}
                  style={{ background: css }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Who sees it */}
        <div className="flex items-center gap-3 border-t px-3 py-2.5">
          <span className="text-xs text-[var(--color-subtitle)]">
            Share with
          </span>
          <div
            className="flex rounded-full bg-[var(--photo-bg)] p-0.5"
            role="radiogroup"
            aria-label="Audience"
          >
            {audience.map(([value, label, Icon]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={closeOnly === value}
                onClick={() => setCloseOnly(value)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  closeOnly === value
                    ? value
                      ? "bg-[#f5a524] text-black"
                      : "bg-[var(--home-card)] text-[var(--title-color)] shadow-sm"
                    : "text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
                }`}
              >
                <Icon
                  className="h-3.5 w-3.5"
                  fill={value && closeOnly ? "currentColor" : "none"}
                />
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-[var(--color-subtitle)]">
            Lasts 24h
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SparkComposer;
