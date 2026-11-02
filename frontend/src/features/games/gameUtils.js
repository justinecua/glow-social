export const LEVELS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

export const levelLabel = (g) => {
  if (g.level_min && g.level_max) return g.level_min === g.level_max ? g.level_min : `${g.level_min}–${g.level_max}`;
  if (g.level_min) return `${g.level_min}+`;
  if (g.level_max) return `Up to ${g.level_max}`;
  return "All levels";
};

export const whenLabel = (g) => {
  const start = new Date(g.starts_at);
  const day = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return g.ends_at ? `${day} · ${time(start)}–${time(new Date(g.ends_at))}` : `${day} · ${time(start)}`;
};

const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

export const courtLinkLabel = (url) => (host(url).includes("courtogo") ? "View on Courtogo" : "View court");

export const DURATIONS = [60, 90, 120, 180]; // minutes

export const durationLabel = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? (h ? `${h}h ${m}m` : `${m}m`) : `${h}h`;
};

export const LEVEL_PRESETS = [
  { key: "all", label: "All levels", min: "", max: "" },
  { key: "beginner", label: "Beginner", min: "2.0", max: "2.5" },
  { key: "intermediate", label: "Intermediate", min: "3.0", max: "3.5" },
  { key: "advanced", label: "Advanced", min: "4.0", max: "" },
];

const pad = (n) => String(n).padStart(2, "0");

export const blankGame = {
  title: "Open Play",
  venue: "",
  date: "", // "YYYY-MM-DD", local
  time: "", // "HH:mm", local
  duration: 120, // minutes, 0 = no end time
  level_min: "",
  level_max: "",
  capacity: 8,
  courts: 2,
  court_url: "",
  maps_url: "",
  court_booked: false,
  notes: "",
};

export const gameToForm = (g) => {
  const start = new Date(g.starts_at);
  return {
    ...blankGame,
    title: g.title,
    venue: g.venue,
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    duration: g.ends_at ? Math.round((new Date(g.ends_at) - start) / 60000) : 0,
    level_min: g.level_min,
    level_max: g.level_max,
    capacity: g.capacity,
    courts: g.courts,
    court_url: g.court_url,
    maps_url: g.maps_url,
    court_booked: g.court_booked,
    notes: g.notes,
  };
};

export const formToGame = (form) => {
  const start = new Date(`${form.date}T${form.time}`);
  const end = form.duration ? new Date(start.getTime() + form.duration * 60000) : null;
  return {
    title: form.title,
    venue: form.venue,
    starts_at: start.toISOString(),
    ends_at: end ? end.toISOString() : "",
    level_min: form.level_min,
    level_max: form.level_max,
    capacity: Number(form.capacity),
    courts: Number(form.courts),
    court_url: form.court_url.trim(),
    maps_url: form.maps_url.trim(),
    court_booked: form.court_booked,
    notes: form.notes,
  };
};

const linkOk = (value) => !value.trim() || isHttpsUrl(value);

export const gameFormReady = (form) =>
  !!(form.title.trim() && form.venue.trim() && form.date && form.time) && linkOk(form.court_url) && linkOk(form.maps_url);

export const isHttpsUrl = (value) => /^https:\/\/[^\s/]+\.[^\s]+$/i.test(value.trim());
