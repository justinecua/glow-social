import { ACCENTS, COVER_PRESETS, DEFAULT_DESIGN, THEMES } from "./options";

const RADIUS = { sharp: "6px", rounded: "14px", round: "26px" };

export const withDefaults = (design) => {
  const saved = Object.fromEntries(Object.entries(design || {}).filter(([key]) => key in DEFAULT_DESIGN)); // drop removed settings
  if (!(saved.theme in THEMES)) delete saved.theme; // a retired theme falls back to the default
  return { ...DEFAULT_DESIGN, ...saved, colors: { ...DEFAULT_DESIGN.colors, ...(saved.colors || {}) } };
};

const accentColor = (design, dark) => {
  if (design.accent !== "custom") return ACCENTS[design.accent]?.[dark ? "dark" : "light"];
  return dark ? `color-mix(in srgb, ${design.accent_custom} 70%, white)` : design.accent_custom; // lighter on dark backgrounds
};

export const profileLook = (design, mode) => {
  const themeKey = design.theme;
  const theme = THEMES[themeKey] ?? THEMES.default;
  const dark = theme.alwaysDark || mode === "dark";
  const palette = theme.alwaysDark ? theme.dark : dark ? theme.dark : theme.light;
  const accent = accentColor(design, dark);

  const vars = { "--pf-radius": RADIUS[design.corners] ?? RADIUS.rounded };
  if (palette) {
    Object.assign(vars, {
      "--home-card": palette.card,
      "--photo-bg": palette.photo,
      "--button-color-bg": palette.accent,
      "--title-color": palette.title,
      "--color-subtitle": palette.subtitle,
      "--foreground": palette.title,
      "--pf-page": palette.page,
      "--background": palette.page,
      color: palette.title,
    });
  }
  if (accent) {
    vars["--button-color-bg"] = accent;
    if (!palette && !dark) vars["--title-color"] = accent; // the default theme uses the accent for headings
  }

  const c = design.colors;
  if (c.page) vars["--pf-page"] = c.page;
  if (c.card) {
    vars["--home-card"] = c.card;
    vars["--photo-bg"] = `color-mix(in srgb, ${c.card} 88%, #808080)`; // chips and image placeholders, a shade off the card
  }
  if (c.inner) {
    vars["--pf-inner"] = c.inner;
    vars["--background"] = c.inner; // post cards
  }
  if (c.heading) vars["--title-color"] = c.heading;
  if (c.text) {
    Object.assign(vars, {
      color: c.text,
      "--foreground": c.text,
      "--color-text": c.text,
      "--color-subtitle": `color-mix(in srgb, ${c.text} 62%, transparent)`,
    });
  }

  return {
    themeKey,
    forceDark: !!theme.alwaysDark,
    serif: !!theme.serif,
    vars,
    themeCover: palette?.cover ?? null,
  };
};

export const presetCover = (design) =>
  design.cover_preset !== "photo" ? COVER_PRESETS[design.cover_preset]?.background ?? null : null;
