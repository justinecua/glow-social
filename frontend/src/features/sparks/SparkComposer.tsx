import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Star, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SPARK_BACKGROUNDS, useCreateSparkMutation } from "@/redux/services/sparks";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

/** Share a spark: a photo (with optional caption) or text on a color. */
const SparkComposer = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [bg, setBg] = useState("sunrise");
  const [closeOnly, setCloseOnly] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [create, { isLoading }] = useCreateSparkMutation();

  useEffect(() => {
    if (!open) return;
    setMode("photo");
    setPhoto(null);
    setText("");
    setBg("sunrise");
    setCloseOnly(false);
  }, [open]);

  const pick = async (file?: File) => {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) return toast.error("Use a JPG, PNG, GIF or WebP image.");
    if (file.size > MAX_BYTES) return toast.error("Photos must be 8 MB or smaller.");
    setPhoto(await readAsDataUrl(file));
  };

  const canShare = !isLoading && (mode === "photo" ? !!photo : !!text.trim());

  const share = async () => {
    if (!canShare) return;
    try {
      await create(
        mode === "photo"
          ? { photo: photo!, text: text.trim(), close_friends_only: closeOnly }
          : { text: text.trim(), background: bg, close_friends_only: closeOnly }
      ).unwrap();
      toast.success(closeOnly ? "Spark shared with Close Friends" : "Spark shared. It fades in 24 hours.");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.data?.detail || "Couldn't share your spark. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isLoading && onOpenChange(o)}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl bg-[var(--home-card)] p-0 sm:max-w-[400px]">
        <DialogTitle className="sr-only">New spark</DialogTitle>

        <div className="flex items-center gap-1 p-3">
          {(["photo", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                mode === m ? "bg-[var(--button-hover-bg-color)] text-[var(--title-color)]" : "text-[var(--color-subtitle)]"
              }`}
            >
              {m === "photo" ? <ImageIcon className="h-4 w-4" /> : <Type className="h-4 w-4" />}
              {m === "photo" ? "Photo" : "Text"}
            </button>
          ))}
        </div>

        {/* Preview, 9:16 like the viewer */}
        <div className="mx-3 aspect-[9/14] overflow-hidden rounded-xl">
          {mode === "photo" ? (
            photo ? (
              <div className="relative h-full w-full bg-black">
                <img src={photo} alt="" className="h-full w-full object-contain" />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  aria-label="Remove photo"
                  className="absolute right-2 top-2 cursor-pointer rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
                <input
                  value={text}
                  maxLength={200}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add a caption…"
                  className="absolute inset-x-4 bottom-4 rounded-lg bg-black/50 px-3 py-2 text-center text-sm text-white outline-none backdrop-blur-sm placeholder:text-white/60"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)]"
              >
                <ImageIcon className="h-8 w-8" />
                <span className="text-sm font-medium">Choose a photo</span>
              </button>
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6" style={{ background: SPARK_BACKGROUNDS[bg] }}>
              <textarea
                autoFocus
                value={text}
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's happening?"
                rows={4}
                className="w-full resize-none bg-transparent text-center text-2xl font-bold text-white outline-none placeholder:text-white/70"
              />
            </div>
          )}
          <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        {mode === "text" && (
          <div className="mx-3 mt-3 flex gap-2" role="radiogroup" aria-label="Background">
            {Object.entries(SPARK_BACKGROUNDS).map(([key, css]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={bg === key}
                aria-label={key}
                onClick={() => setBg(key)}
                className={`h-7 w-7 cursor-pointer rounded-full ring-offset-2 ring-offset-[var(--home-card)] ${bg === key ? "ring-2 ring-[var(--title-color)]" : ""}`}
                style={{ background: css }}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => setCloseOnly((c) => !c)}
            aria-pressed={closeOnly}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
              closeOnly ? "border-[#f5a524] bg-[#f5a524]/15 text-[#c27c00] dark:text-[#ffd66b]" : "text-[var(--color-subtitle)]"
            }`}
          >
            <Star className="h-3.5 w-3.5" fill={closeOnly ? "currentColor" : "none"} />
            {closeOnly ? "Close friends only" : "All friends"}
          </button>
          <button
            type="button"
            onClick={share}
            disabled={!canShare}
            className="ml-auto flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[var(--button-color-bg)] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Share spark
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SparkComposer;
