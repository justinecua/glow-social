import { useState } from "react";
import {
  AlignLeft,
  CalendarDays,
  ExternalLink,
  Link2,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Signal,
  UsersRound,
  X,
} from "lucide-react";
import { DURATIONS, LEVELS, LEVEL_PRESETS, durationLabel, isHttpsUrl } from "./gameUtils";
import { useCourtPreview } from "./useCourtPreview";

const textInput =
  "w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[var(--color-subtitle)]";
const pill =
  "h-9 rounded-lg bg-[var(--photo-bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--button-color-bg)] dark:[color-scheme:dark]";

const Row = ({ icon: Icon, children }) => (
  <div className="flex gap-3 px-4 py-2">
    <Icon className="mt-2 h-4 w-4 shrink-0 text-[var(--color-subtitle)]" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      {children}
    </div>
  </div>
);

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`h-7 cursor-pointer rounded-full px-2.5 text-xs font-medium transition-colors ${
      active
        ? "bg-[var(--button-color-bg)] text-white"
        : "bg-[var(--photo-bg)] text-[var(--title-color)] hover:bg-[var(--button-hover-bg-color)] dark:text-white"
    }`}
  >
    {children}
  </button>
);

const Stepper = ({ label, value, min, max, onChange }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-sm">{label}</span>
    <div className="flex items-center gap-0.5 rounded-full bg-[var(--photo-bg)] p-0.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Fewer ${label.toLowerCase()}`}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full hover:bg-[var(--button-hover-bg-color)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`More ${label.toLowerCase()}`}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full hover:bg-[var(--button-hover-bg-color)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

const Switch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex cursor-pointer items-center gap-2 text-sm"
  >
    <span
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-emerald-500" : "bg-[var(--button-hover-bg-color)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </span>
    {label}
  </button>
);

const CourtLinkPreview = ({ url }) => {
  const preview = useCourtPreview(url);
  if (preview.loading) return <div className="mt-2 h-16 animate-pulse rounded-lg bg-[var(--photo-bg)]" />;
  if (!preview.image && !preview.title) return null;
  return (
    <div className="mt-2 flex items-center gap-3 overflow-hidden rounded-lg bg-[var(--photo-bg)]">
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          referrerPolicy="no-referrer"
          onError={preview.onError}
          className="h-16 w-24 shrink-0 object-cover"
        />
      )}
      <div className={`min-w-0 py-2 pr-3 ${preview.image ? "" : "pl-3"}`}>
        <p className="line-clamp-1 text-sm font-medium">{preview.title || "Court page"}</p>
        <p className="flex items-center gap-1 text-xs text-[var(--color-subtitle)]">
          <ExternalLink className="h-3 w-3" /> Players will see this on the post
        </p>
      </div>
    </div>
  );
};

const GameFields = ({ form, onChange, onRemove }) => {
  const [blurredUrl, setPreviewUrl] = useState(null);
  const previewUrl = blurredUrl ?? (isHttpsUrl(form.court_url) ? form.court_url.trim() : ""); // saved links preview right away; typed ones after leaving the field
  const update = (changes) => onChange({ ...form, ...changes });
  const text = (key) => (e) => update({ [key]: e.target.value });

  const preset = LEVEL_PRESETS.find((p) => p.min === form.level_min && p.max === form.level_max);
  const [customPicked, setCustomLevel] = useState(false);
  const customLevel = customPicked || !preset; // a saved range that matches no preset shows as Custom
  const durations = DURATIONS.includes(form.duration) || !form.duration ? DURATIONS : [...DURATIONS, form.duration];
  const [morePicked, setMoreOpen] = useState(false);
  const moreOpen = morePicked || !!form.maps_url || !!form.notes; // a game being edited shows what it already has
  const courtUrlBad = form.court_url.trim() && !isHttpsUrl(form.court_url);
  const mapUrlBad = form.maps_url.trim() && !isHttpsUrl(form.maps_url);

  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="flex items-center gap-2 px-4 pb-1 pt-3">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--button-color-bg)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--button-color-bg)] dark:text-white">
          <CalendarDays className="h-3 w-3" /> Game
        </span>
        <input
          value={form.title}
          onChange={text("title")}
          maxLength={100}
          placeholder="Name your game"
          aria-label="Game name"
          className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-[var(--color-subtitle)]"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove game"
            title="Remove game"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-subtitle)] hover:bg-[var(--button-hover-bg-color)] hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="divide-y">
        <Row icon={MapPin}>
          <input
            value={form.venue}
            onChange={text("venue")}
            maxLength={150}
            placeholder="Where are you playing?"
            aria-label="Where"
            className={`${textInput} h-8`}
          />
        </Row>

        <Row icon={CalendarDays}>
          <div className="flex flex-wrap gap-2">
            <input type="date" value={form.date} onChange={text("date")} aria-label="Date" className={`${pill} min-w-36 flex-1`} />
            <input type="time" value={form.time} onChange={text("time")} aria-label="Start time" className={`${pill} w-28`} />
            <select
              value={form.duration}
              onChange={(e) => update({ duration: Number(e.target.value) })}
              aria-label="How long"
              className={`${pill} w-28`}
            >
              {durations.map((m) => (
                <option key={m} value={m}>{durationLabel(m)}</option>
              ))}
              <option value={0}>No end time</option>
            </select>
          </div>
        </Row>

        <Row icon={Signal}>
          <div className="flex flex-wrap gap-1.5">
            {LEVEL_PRESETS.map((p) => (
              <Chip
                key={p.key}
                active={!customLevel && preset?.key === p.key}
                onClick={() => {
                  setCustomLevel(false);
                  update({ level_min: p.min, level_max: p.max });
                }}
              >
                {p.label}
              </Chip>
            ))}
            <Chip active={customLevel} onClick={() => setCustomLevel(true)}>
              Custom
            </Chip>
          </div>
          {customLevel && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <select value={form.level_min} onChange={text("level_min")} aria-label="Lowest level" className={`${pill} flex-1`}>
                <option value="">Any</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <span className="text-[var(--color-subtitle)]">to</span>
              <select value={form.level_max} onChange={text("level_max")} aria-label="Highest level" className={`${pill} flex-1`}>
                <option value="">Any</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          )}
        </Row>

        <Row icon={UsersRound}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Stepper label="Players" value={Number(form.capacity)} min={2} max={64} onChange={(v) => update({ capacity: v })} />
            <Stepper label="Courts" value={Number(form.courts)} min={1} max={20} onChange={(v) => update({ courts: v })} />
          </div>
        </Row>

        <Row icon={Link2}>
          <div className="flex items-center gap-3">
            <input
              type="url"
              inputMode="url"
              value={form.court_url}
              onChange={(e) => {
                setPreviewUrl(""); // hide the preview while typing; it loads again on blur
                update({ court_url: e.target.value });
              }}
              onBlur={() => setPreviewUrl(isHttpsUrl(form.court_url) ? form.court_url.trim() : "")}
              placeholder="Courtogo or booking link"
              aria-label="Court link"
              className={`${textInput} h-8 flex-1`}
            />
            <Switch checked={form.court_booked} onChange={(v) => update({ court_booked: v })} label="Booked" />
          </div>
          {courtUrlBad && <p className="mt-1 text-xs text-red-500">Use a full link starting with https://</p>}
          {previewUrl && !courtUrlBad && <CourtLinkPreview url={previewUrl} />}
        </Row>

        {moreOpen ? (
          <>
            <Row icon={Navigation}>
              <input
                type="url"
                inputMode="url"
                value={form.maps_url}
                onChange={text("maps_url")}
                placeholder="Map link (optional)"
                aria-label="Map link"
                className={`${textInput} h-8`}
              />
              {mapUrlBad && <p className="mt-1 text-xs text-red-500">Use a full link starting with https://</p>}
            </Row>
            <Row icon={AlignLeft}>
              <textarea
                value={form.notes}
                onChange={text("notes")}
                maxLength={500}
                rows={2}
                placeholder="Notes: bring your own paddle, balls provided, court fee split…"
                aria-label="Notes"
                className={`${textInput} resize-none py-1.5`}
              />
            </Row>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-xs font-medium text-[var(--color-subtitle)] hover:bg-[var(--photo-bg)] hover:text-[var(--title-color)]"
          >
            <Plus className="h-3.5 w-3.5" /> Map link & notes
          </button>
        )}
      </div>
    </div>
  );
};

export default GameFields;
