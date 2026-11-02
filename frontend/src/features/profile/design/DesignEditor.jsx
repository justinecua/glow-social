import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Eye,
  LayoutList,
  Loader2,
  Lock,
  Palette,
  PanelTop,
  Plus,
  RotateCcw,
  SwatchBook,
  Trash2,
  Trophy,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { useGetMyFriendsQuery } from "@/redux/services/discover";
import {
  ABOUT_KINDS,
  ACCENTS,
  BLOCKS,
  CHOICES,
  COLOR_PARTS,
  COVER_PRESETS,
  LEVELS,
  LINK_KINDS,
  NAME_BADGES,
  PLAY_STYLES,
  REWARDS,
  STATS,
  TAB_LABELS,
  THEMES,
  newBlock,
} from "./options";

const input =
  "h-9 w-full min-w-0 rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-[var(--button-color-bg)]";

const pathOf = (url) => {
  try {
    return new URL(url, window.location.origin).pathname; // saved photos are /media/... paths, picked ones are full URLs
  } catch {
    return url;
  }
};

const move = (list, index, by) => {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + by, 0, item);
  return next;
};

const Field = ({ label, children }) => (
  <div>
    <p className="mb-1.5 text-xs font-medium text-[var(--color-subtitle)]">{label}</p>
    {children}
  </div>
);

const Chips = ({ value, options, onChange, hidden = [] }) => (
  <div className="flex flex-wrap gap-1.5">
    {Object.entries(options)
      .filter(([key]) => !hidden.includes(key) || key === value)
      .map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`h-8 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors ${
            value === key ? "bg-[var(--button-color-bg)] text-white" : "bg-[var(--photo-bg)] hover:bg-[var(--button-hover-bg-color)]"
          }`}
        >
          {label}
        </button>
      ))}
  </div>
);

const ThemePicker = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-2">
    {Object.entries(THEMES).map(([key, theme]) => {
      const palette = theme.light ?? theme.dark;
      return (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`cursor-pointer overflow-hidden rounded-xl border-2 text-left ${
            value === key ? "border-[var(--button-color-bg)]" : "border-transparent"
          }`}
        >
          <span className="block h-12" style={{ background: palette?.cover ?? "linear-gradient(135deg, #2442de, #a9b8ff)" }} />
          <span className="block bg-[var(--photo-bg)] px-2 py-1.5 text-[11px] font-medium">{theme.label}</span>
        </button>
      );
    })}
  </div>
);

const AccentPicker = ({ value, custom, onChange, onCustom }) => (
  <div className="flex flex-wrap items-center gap-2">
    {Object.entries(ACCENTS)
      .filter(([key]) => key !== "custom")
      .map(([key, accent]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          title={accent.label}
          aria-label={accent.label}
          className={`h-8 w-8 cursor-pointer rounded-full ring-offset-2 ring-offset-[var(--home-card)] ${value === key ? "ring-2 ring-[var(--title-color)]" : ""}`}
          style={{ background: accent.light ?? "conic-gradient(#2442de, #ec4899, #f59e0b, #10b981, #2442de)" }}
        />
      ))}
    <label
      title="Pick any colour"
      className={`relative flex h-8 cursor-pointer items-center gap-1.5 rounded-full border pl-1 pr-2.5 text-xs font-medium ring-offset-2 ring-offset-[var(--home-card)] ${
        value === "custom" ? "ring-2 ring-[var(--title-color)]" : ""
      }`}
    >
      <span className="h-6 w-6 rounded-full border" style={{ background: custom }} />
      {value === "custom" ? custom.toUpperCase() : "Custom"}
      <input
        type="color"
        value={custom}
        onChange={(e) => onCustom(e.target.value)}
        aria-label="Custom accent colour"
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  </div>
);

const RowControls = ({ index, count, onMove, onRemove, removable = true }) => (
  <span className="ml-auto flex items-center gap-0.5">
    <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)} className="cursor-pointer rounded p-1 hover:bg-[var(--photo-bg)] disabled:opacity-30">
      <ArrowUp className="h-3.5 w-3.5" />
    </button>
    <button type="button" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)} className="cursor-pointer rounded p-1 hover:bg-[var(--photo-bg)] disabled:opacity-30">
      <ArrowDown className="h-3.5 w-3.5" />
    </button>
    {removable && (
      <button type="button" aria-label="Remove" onClick={onRemove} className="cursor-pointer rounded p-1 text-[var(--color-subtitle)] hover:bg-[var(--photo-bg)] hover:text-red-500">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )}
  </span>
);

const BlockSettings = ({ block, onChange, posts, allPhotos, friends }) => {
  const set = (changes) => onChange({ ...block, ...changes });

  switch (block.type) {
    case "pinned_post":
      return (
        <select value={block.post_id ?? ""} onChange={(e) => set({ post_id: Number(e.target.value) || null })} className={input}>
          <option value="">Choose a post…</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {(p.caption || (p.photos?.length ? "Photo post" : "Post")).slice(0, 60)}
            </option>
          ))}
        </select>
      );
    case "featured_photos":
      return allPhotos.length ? (
        <div className="grid grid-cols-4 gap-1.5">
          {allPhotos.slice(0, 40).map((src) => {
            const position = block.photos.findIndex((p) => pathOf(p) === pathOf(src));
            const picked = position !== -1;
            return (
              <button
                key={src}
                type="button"
                onClick={() =>
                  set({
                    photos: picked
                      ? block.photos.filter((p) => pathOf(p) !== pathOf(src))
                      : [...block.photos, src].slice(0, 6),
                  })
                }
                aria-pressed={picked}
                className={`relative aspect-square cursor-pointer overflow-hidden rounded-md ${picked ? "ring-2 ring-[var(--button-color-bg)]" : "opacity-70 hover:opacity-100"}`}
              >
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                {picked && (
                  <span className="absolute right-1 top-1 rounded-full bg-[var(--button-color-bg)] px-1.5 text-[10px] font-semibold text-white">
                    {position + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-subtitle)]">Post some photos first.</p>
      );
    case "about_cards":
      return (
        <div className="space-y-2">
          {block.cards.map((card, i) => (
            <div key={i} className="flex gap-1.5">
              <select
                value={card.kind}
                onChange={(e) => set({ cards: block.cards.map((c, j) => (j === i ? { ...c, kind: e.target.value } : c)) })}
                className={`${input} w-36 shrink-0`}
              >
                {Object.entries(ABOUT_KINDS).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
              <input
                value={card.text}
                maxLength={60}
                onChange={(e) => set({ cards: block.cards.map((c, j) => (j === i ? { ...c, text: e.target.value } : c)) })}
                placeholder="Training for 4.0"
                className={input}
              />
              <button type="button" aria-label="Remove card" onClick={() => set({ cards: block.cards.filter((_, j) => j !== i) })} className="cursor-pointer px-1 text-[var(--color-subtitle)] hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {block.cards.length < 4 && (
            <button type="button" onClick={() => set({ cards: [...block.cards, { kind: "ask_me", text: "" }] })} className="flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--button-color-bg)]">
              <Plus className="h-3.5 w-3.5" /> Add card
            </button>
          )}
        </div>
      );
    case "pickleball":
      return (
        <div className="grid grid-cols-2 gap-2">
          <select value={block.level} onChange={(e) => set({ level: e.target.value })} className={input} aria-label="Level">
            <option value="">Level</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select value={block.style} onChange={(e) => set({ style: e.target.value })} className={input} aria-label="Play style">
            {Object.entries(PLAY_STYLES).map(([k, l]) => (
              <option key={k} value={k}>{k ? l : "Play style"}</option>
            ))}
          </select>
          <input value={block.home_court} maxLength={80} onChange={(e) => set({ home_court: e.target.value })} placeholder="Home court" className={`${input} col-span-2`} />
          <input value={block.court_url} onChange={(e) => set({ court_url: e.target.value })} placeholder="Courtogo or booking link (https://…)" className={`${input} col-span-2`} />
        </div>
      );
    case "links":
      return (
        <div className="space-y-2">
          {block.links.map((link, i) => (
            <div key={i} className="flex gap-1.5">
              <select
                value={link.kind}
                onChange={(e) => set({ links: block.links.map((l, j) => (j === i ? { ...l, kind: e.target.value } : l)) })}
                className={`${input} w-32 shrink-0`}
              >
                {Object.entries(LINK_KINDS).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
              <input
                value={link.url}
                onChange={(e) => set({ links: block.links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)) })}
                placeholder="https://"
                className={input}
              />
              <button type="button" aria-label="Remove link" onClick={() => set({ links: block.links.filter((_, j) => j !== i) })} className="cursor-pointer px-1 text-[var(--color-subtitle)] hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {block.links.length < 6 && (
            <button type="button" onClick={() => set({ links: [...block.links, { kind: "website", url: "" }] })} className="flex cursor-pointer items-center gap-1 text-xs font-medium text-[var(--button-color-bg)]">
              <Plus className="h-3.5 w-3.5" /> Add link
            </button>
          )}
        </div>
      );
    case "song":
      return (
        <div className="space-y-2">
          <input value={block.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} placeholder="Song title" className={input} />
          <input value={block.artist} maxLength={60} onChange={(e) => set({ artist: e.target.value })} placeholder="Artist" className={input} />
          <input value={block.url} onChange={(e) => set({ url: e.target.value })} placeholder="Spotify or YouTube link (optional)" className={input} />
        </div>
      );
    case "spotlight":
      return (
        <div className="space-y-2">
          <select value={block.account_id ?? ""} onChange={(e) => set({ account_id: Number(e.target.value) || null })} className={input}>
            <option value="">Choose a friend…</option>
            {friends.map((f) => (
              <option key={f.id} value={f.id}>
                {[f.firstname, f.lastname].filter(Boolean).join(" ") || f.username}
              </option>
            ))}
          </select>
          <input value={block.note} maxLength={80} onChange={(e) => set({ note: e.target.value })} placeholder="My doubles partner" className={input} />
        </div>
      );
    default:
      return <p className="text-xs text-[var(--color-subtitle)]">{BLOCKS[block.type]?.hint}</p>;
  }
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const readabilityWarnings = (colors) => {
  const checks = [
    ["heading", "card", 3, "Headings are hard to read on your profile card."],
    ["text", "card", 4.5, "Text is hard to read on your profile card."],
    ["text", "inner", 4.5, "Text is hard to read on your inner cards."],
  ];
  return checks
    .filter(([fg, bg, min]) => colors[fg] && colors[bg] && contrast(colors[fg], colors[bg]) < min)
    .map(([, , , message]) => message);
};

const ColorRow = ({ part, value, onChange }) => (
  <div className="flex items-center gap-3 rounded-xl bg-[var(--photo-bg)] p-2.5">
    <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border" title={`Pick ${part.label.toLowerCase()} colour`}>
      <span
        className="block h-full w-full"
        style={{ background: value || "repeating-conic-gradient(#cbd5e1 0 25%, #f1f5f9 0 50%) 0 0 / 10px 10px" }}
      />
      <input
        type="color"
        value={value || "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        aria-label={part.label}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{part.label}</p>
      <p className="truncate text-xs text-[var(--color-subtitle)]">{value ? value.toUpperCase() : `Theme · ${part.hint}`}</p>
    </div>
    {value && (
      <button
        type="button"
        onClick={() => onChange("")}
        className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)]"
      >
        Reset
      </button>
    )}
  </div>
);

const Rewards = ({ draft, unlocks, onUse }) => (
  <div className="space-y-2">
    <p className="text-xs text-[var(--color-subtitle)]">Earn these by being active on Glow.</p>
    {REWARDS.map((reward) => {
      const info = unlocks?.[`${reward.setting}:${reward.value}`];
      const using = draft[reward.setting] === reward.value;
      const pct = info ? Math.round((info.progress / info.goal) * 100) : 0;
      return (
        <div key={reward.value} className="rounded-xl border p-3">
          <div className="flex items-center gap-2">
            {info?.unlocked ? <Trophy className="h-4 w-4 text-[var(--button-color-bg)]" /> : <Lock className="h-4 w-4 text-[var(--color-subtitle)]" />}
            <p className="text-sm font-semibold">{reward.label}</p>
            {info?.unlocked && (
              <button
                type="button"
                onClick={() => onUse(reward)}
                disabled={using}
                className="ml-auto h-7 cursor-pointer rounded-full bg-[var(--button-color-bg)] px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                {using ? "In use" : "Use"}
              </button>
            )}
          </div>
          {info && !info.unlocked && (
            <>
              <p className="mt-1 text-xs text-[var(--color-subtitle)]">
                {info.label} · {info.progress}/{info.goal}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--photo-bg)]">
                <div className="h-full rounded-full bg-[var(--button-color-bg)]" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
        </div>
      );
    })}
  </div>
);

const TABS = [
  { key: "theme", label: "Theme", icon: SwatchBook },
  { key: "colors", label: "Colors", icon: Palette },
  { key: "header", label: "Header", icon: PanelTop },
  { key: "you", label: "You", icon: UserRound },
  { key: "sections", label: "Sections", icon: LayoutList },
  { key: "rewards", label: "Rewards", icon: Trophy },
];

const DesignEditor = ({
  draft,
  onChange,
  unlocks,
  posts,
  allPhotos,
  canUndo,
  onUndo,
  onReset,
  onVisitor,
  onSave,
  onPublish,
  onClose,
  saving,
  savingAction,
  dirty,
  error,
}) => {
  const [tab, setTab] = useState("theme");
  const { data: friendsData } = useGetMyFriendsQuery();
  const friends = friendsData?.friends ?? [];
  const set = (changes) => onChange({ ...draft, ...changes });
  const setColor = (key, value) => set({ colors: { ...draft.colors, [key]: value } });
  const lockedValues = (setting) =>
    REWARDS.filter((r) => r.setting === setting && !unlocks?.[`${r.setting}:${r.value}`]?.unlocked).map((r) => r.value);
  const unusedBlocks = Object.keys(BLOCKS).filter((type) => !draft.blocks.some((b) => b.type === type));
  const hiddenTabs = Object.keys(TAB_LABELS).filter((t) => !draft.tabs.includes(t));
  const warnings = readabilityWarnings(draft.colors);
  const anyColor = Object.values(draft.colors).some(Boolean);

  return (
    <aside
      aria-label="Profile design"
      className="fixed inset-x-0 bottom-0 z-50 flex h-[75dvh] flex-col overflow-x-hidden rounded-t-2xl border-t bg-[var(--home-card)] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.35)] md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[380px] md:rounded-none md:border-l md:border-t-0"
    >
      <div className="flex items-center gap-1 border-b px-3 py-2.5">
        <h2 className="mr-auto pl-1 text-base font-semibold">Design</h2>
        <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo" aria-label="Undo" className="cursor-pointer rounded-lg p-2 hover:bg-[var(--photo-bg)] disabled:opacity-30">
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={onReset} title="Reset to default" aria-label="Reset to default" className="cursor-pointer rounded-lg p-2 hover:bg-[var(--photo-bg)]">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button type="button" onClick={onVisitor} title="See as visitor" aria-label="See as visitor" className="cursor-pointer rounded-lg p-2 hover:bg-[var(--photo-bg)]">
          <Eye className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} title="Done" aria-label="Done" className="cursor-pointer rounded-lg p-2 hover:bg-[var(--photo-bg)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="grid grid-cols-6 border-b" aria-label="Design sections">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={`flex cursor-pointer flex-col items-center gap-1 border-b-2 py-2 text-[10px] font-medium transition-colors ${
              tab === key
                ? "border-[var(--button-color-bg)] text-[var(--button-color-bg)] dark:text-white"
                : "border-transparent text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden p-4">
        {tab === "theme" && (
          <>
            <Field label="Theme">
              <ThemePicker value={draft.theme} onChange={(theme) => set({ theme })} />
            </Field>
            <Field label="Cards">
              <Chips value={draft.card_style} options={CHOICES.card_style} onChange={(card_style) => set({ card_style })} />
            </Field>
            <Field label="Background pattern">
              <Chips value={draft.background} options={CHOICES.background} onChange={(background) => set({ background })} />
            </Field>
            <Field label="Corners">
              <Chips value={draft.corners} options={CHOICES.corners} onChange={(corners) => set({ corners })} />
            </Field>
          </>
        )}

        {tab === "colors" && (
          <>
            <Field label="Accent (buttons, tabs, highlights)">
              <AccentPicker
                value={draft.accent}
                custom={draft.accent_custom}
                onChange={(accent) => set({ accent })}
                onCustom={(accent_custom) => set({ accent: "custom", accent_custom })}
              />
            </Field>
            <Field label="Profile colours">
              <div className="space-y-2">
                {COLOR_PARTS.map((part) => (
                  <ColorRow key={part.key} part={part} value={draft.colors[part.key]} onChange={(v) => setColor(part.key, v)} />
                ))}
              </div>
            </Field>
            {warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w} Try a darker or lighter colour.
              </p>
            ))}
            {anyColor && (
              <button
                type="button"
                onClick={() => set({ colors: Object.fromEntries(COLOR_PARTS.map((p) => [p.key, ""])) })}
                className="cursor-pointer text-xs font-medium text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
              >
                Reset all colours to the theme
              </button>
            )}
          </>
        )}

        {tab === "header" && (
          <>
            <Field label="Layout">
              <Chips value={draft.header_layout} options={CHOICES.header_layout} onChange={(header_layout) => set({ header_layout })} />
            </Field>
            <Field label="Cover">
              <Chips
                value={draft.cover_preset}
                options={Object.fromEntries(Object.entries(COVER_PRESETS).map(([k, v]) => [k, v.label]))}
                onChange={(cover_preset) => set({ cover_preset })}
              />
            </Field>
            <Field label="Cover height">
              <Chips value={draft.cover_height} options={CHOICES.cover_height} onChange={(cover_height) => set({ cover_height })} />
            </Field>
            <Field label="Cover motion">
              <Chips value={draft.cover_animation} options={CHOICES.cover_animation} onChange={(cover_animation) => set({ cover_animation })} />
            </Field>
          </>
        )}

        {tab === "you" && (
          <>
            <Field label="Photo frame">
              <Chips value={draft.avatar_frame} options={CHOICES.avatar_frame} onChange={(avatar_frame) => set({ avatar_frame })} hidden={lockedValues("avatar_frame")} />
            </Field>
            <Field label="Photo shape">
              <Chips value={draft.avatar_shape} options={CHOICES.avatar_shape} onChange={(avatar_shape) => set({ avatar_shape })} />
            </Field>
            <Field label="Name style">
              <Chips value={draft.name_effect} options={CHOICES.name_effect} onChange={(name_effect) => set({ name_effect })} hidden={lockedValues("name_effect")} />
            </Field>
            <Field label="Badge next to your name">
              <div className="grid grid-cols-6 gap-1.5">
                {NAME_BADGES.map((badge) => (
                  <button
                    key={badge || "none"}
                    type="button"
                    onClick={() => set({ name_badge: badge })}
                    aria-pressed={draft.name_badge === badge}
                    aria-label={badge || "No badge"}
                    className={`flex aspect-square cursor-pointer items-center justify-center rounded-lg text-lg ${
                      draft.name_badge === badge ? "bg-[var(--button-color-bg)] text-white" : "bg-[var(--photo-bg)]"
                    }`}
                  >
                    {badge || <X className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Mood">
              <div className="flex gap-2">
                <input
                  value={draft.mood.emoji}
                  maxLength={8}
                  onChange={(e) => set({ mood: { ...draft.mood, emoji: e.target.value } })}
                  placeholder="🔥"
                  aria-label="Mood emoji"
                  className="h-9 w-12 shrink-0 rounded-lg border bg-transparent text-center text-sm outline-none focus:border-[var(--button-color-bg)]"
                />
                <input
                  value={draft.mood.text}
                  maxLength={40}
                  onChange={(e) => set({ mood: { ...draft.mood, text: e.target.value } })}
                  placeholder="Tournament week"
                  aria-label="Mood text"
                  className={input}
                />
              </div>
            </Field>
          </>
        )}

        {tab === "sections" && (
          <>
            <Field label={`Stats under your name (${draft.stats.length}/3)`}>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(STATS).map(([key, stat]) => {
                  const on = draft.stats.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!on && draft.stats.length >= 3}
                      onClick={() => set({ stats: on ? draft.stats.filter((s) => s !== key) : [...draft.stats, key] })}
                      aria-pressed={on}
                      className={`h-8 cursor-pointer rounded-full px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                        on ? "bg-[var(--button-color-bg)] text-white" : "bg-[var(--photo-bg)]"
                      }`}
                    >
                      {stat.many}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={`Blocks (${draft.blocks.length})`}>
              <div className="space-y-2">
                {draft.blocks.map((block, i) => (
                  <div key={block.type} className="rounded-xl border p-3">
                    <div className="mb-2 flex items-center text-sm font-semibold">
                      {BLOCKS[block.type].label}
                      <RowControls
                        index={i}
                        count={draft.blocks.length}
                        onMove={(by) => set({ blocks: move(draft.blocks, i, by) })}
                        onRemove={() => set({ blocks: draft.blocks.filter((b) => b.type !== block.type) })}
                      />
                    </div>
                    <BlockSettings
                      block={block}
                      onChange={(updated) => set({ blocks: draft.blocks.map((b) => (b.type === block.type ? updated : b)) })}
                      posts={posts}
                      allPhotos={allPhotos}
                      friends={friends}
                    />
                  </div>
                ))}
                {unusedBlocks.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {unusedBlocks.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set({ blocks: [...draft.blocks, newBlock(type)] })}
                        title={BLOCKS[type].hint}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-2 text-left text-xs font-medium hover:bg-[var(--photo-bg)]"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{BLOCKS[type].label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            <Field label="Tabs">
              <div className="space-y-1">
                {draft.tabs.map((t, i) => (
                  <div key={t} className="flex items-center rounded-lg bg-[var(--photo-bg)] px-3 py-1.5 text-sm">
                    {TAB_LABELS[t]}
                    <RowControls
                      index={i}
                      count={draft.tabs.length}
                      onMove={(by) => set({ tabs: move(draft.tabs, i, by) })}
                      onRemove={() => set({ tabs: draft.tabs.filter((x) => x !== t) })}
                      removable={t !== "posts"}
                    />
                  </div>
                ))}
                {hiddenTabs.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set({ tabs: [...draft.tabs, t] })}
                    className="flex w-full cursor-pointer items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-sm text-[var(--color-subtitle)]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Show {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {tab === "rewards" && <Rewards draft={draft} unlocks={unlocks} onUse={(r) => set({ [r.setting]: r.value })} />}
      </div>

      <div className="border-t px-4 py-3">
        {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-semibold hover:bg-[var(--photo-bg)] disabled:opacity-40"
          >
            {savingAction === "draft" && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingAction === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={saving}
            className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--button-color-bg)] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {savingAction === "publish" && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingAction === "publish" ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DesignEditor;
