export const PROFILE_DESIGN_ENABLED = false; // profile design editor is off for now; set to true to bring it back

export const DEFAULT_DESIGN = {
  theme: "default",
  accent: "theme",
  accent_custom: "#2442de",
  colors: { page: "", card: "", inner: "", heading: "", text: "" }, // "" = the theme's colour
  card_style: "flat",
  background: "plain",
  corners: "rounded",
  name_effect: "none",
  name_badge: "",
  header_layout: "classic",
  cover_preset: "photo",
  cover_animation: "none",
  cover_height: "normal",
  avatar_frame: "none",
  avatar_shape: "circle",
  stats: ["glows", "kudos", "friends"],
  tabs: ["posts", "photos", "thoughts", "glows", "about"],
  mood: { emoji: "", text: "" },
  blocks: [],
};

// Each theme sets the profile's own colours in light and dark mode. `null` = the app's normal colours.
export const THEMES = {
  default: { label: "Glow", light: null, dark: null },
  sunrise: {
    label: "Sunrise",
    light: { page: "#fff4ec", card: "#fffaf6", photo: "#fde9dc", accent: "#e8632b", title: "#8a3412", subtitle: "#8c6d5f", cover: "linear-gradient(135deg, #ffb38a, #ffd36e 55%, #ff8fa3)" },
    dark: { page: "#1a1210", card: "#221714", photo: "#2e1f1a", accent: "#ff8a4c", title: "#ffd9c2", subtitle: "#b69585", cover: "linear-gradient(135deg, #7a3418, #8a5a14 55%, #7a2a3a)" },
  },
  ocean: {
    label: "Ocean",
    light: { page: "#eef6fb", card: "#f8fcff", photo: "#e0eef7", accent: "#0d7fb8", title: "#0b4f73", subtitle: "#5b7a8c", cover: "linear-gradient(135deg, #2563eb, #0ea5e9 50%, #14b8a6)" },
    dark: { page: "#07131a", card: "#0b1c25", photo: "#11283a", accent: "#38bdf8", title: "#cfefff", subtitle: "#7fa2b5", cover: "linear-gradient(135deg, #1e3a8a, #075985 50%, #115e59)" },
  },
  paper: {
    label: "Paper",
    serif: true,
    light: { page: "#f3efe6", card: "#fbf8f1", photo: "#ece5d6", accent: "#3b3a36", title: "#1f1d1a", subtitle: "#7a7468", cover: "linear-gradient(180deg, #efe8da, #e6dcc8)" },
    dark: { page: "#15140f", card: "#1c1b16", photo: "#262419", accent: "#e9e1cf", title: "#f3ecdc", subtitle: "#a39b8a", cover: "linear-gradient(180deg, #2a271e, #211f18)" },
  },
  neon: {
    label: "Neon",
    alwaysDark: true,
    dark: { page: "#050505", card: "#0b0b0d", photo: "#16161a", accent: "#ff4fd8", title: "#ffffff", subtitle: "#8b8b99", cover: "radial-gradient(120% 120% at 0% 0%, #ff4fd8 0%, transparent 50%), radial-gradient(120% 120% at 100% 100%, #2ee6ff 0%, transparent 50%), #0b0b0d" },
  },
};

export const ACCENTS = {
  theme: { label: "Theme colour" },
  blue: { label: "Blue", light: "#2442de", dark: "#6f8bff" },
  violet: { label: "Violet", light: "#6d28d9", dark: "#a78bfa" },
  rose: { label: "Rose", light: "#e11d48", dark: "#fb7185" },
  orange: { label: "Orange", light: "#ea580c", dark: "#fb923c" },
  green: { label: "Green", light: "#15803d", dark: "#4ade80" },
  teal: { label: "Teal", light: "#0f766e", dark: "#2dd4bf" },
  gold: { label: "Gold", light: "#b7791f", dark: "#f6c453" },
  custom: { label: "Custom" },
};

export const COVER_PRESETS = {
  photo: { label: "My photo" },
  aurora: { label: "Aurora", background: "linear-gradient(120deg, #2442de, #7c3aed 45%, #ec4899)" },
  dusk: { label: "Dusk", background: "linear-gradient(180deg, #1e1b4b, #7c2d12 70%, #f59e0b)" },
  court: {
    label: "Court",
    background:
      "linear-gradient(90deg, transparent 49.6%, rgba(255,255,255,.55) 49.6% 50.4%, transparent 50.4%), linear-gradient(0deg, transparent 33%, rgba(255,255,255,.35) 33% 34%, transparent 34% 66%, rgba(255,255,255,.35) 66% 67%, transparent 67%), linear-gradient(135deg, #0b1a4a, #13285e)",
  },
  waves: { label: "Waves", background: "radial-gradient(60% 80% at 20% 120%, #14b8a6 0%, transparent 60%), radial-gradient(60% 80% at 80% 120%, #0ea5e9 0%, transparent 60%), linear-gradient(180deg, #e0f2fe, #bae6fd)" },
  sunrise: { label: "Sunrise", background: THEMES.sunrise.light.cover },
};

export const CHOICES = {
  card_style: { flat: "Flat", shadow: "Soft shadow", outline: "Outlined", glass: "Glass" },
  background: { plain: "Plain", dots: "Dots", court: "Court lines", grid: "Grid", cover_blur: "Blurred cover" },
  corners: { sharp: "Sharp", rounded: "Rounded", round: "Extra round" },
  header_layout: { classic: "Classic", centered: "Centered", split: "Split", no_cover: "No cover" },
  cover_height: { compact: "Compact", normal: "Normal", tall: "Tall" },
  cover_animation: { none: "Still", drift: "Colour drift", pan: "Slow pan" },
  avatar_frame: { none: "None", accent: "Colour ring", glow: "Glow", double: "Double", sparks: "Sparks", rising: "Rising", anniversary: "Anniversary", holiday: "Holiday" },
  avatar_shape: { circle: "Circle", rounded: "Rounded square" },
  name_effect: { none: "Plain", gradient: "Gradient", swash: "Underline", gold: "Gold" },
};

export const NAME_BADGES = ["", "🏓", "📸", "🎨", "🎵", "⚽", "📚", "✈️", "💻", "🎮", "☕"];

export const STATS = {
  glows: { one: "Glow", many: "Glows" },
  kudos: { one: "Kudos", many: "Kudos" },
  friends: { one: "Friend", many: "Friends" },
  games: { one: "Game played", many: "Games played" },
  chain: { one: "Longest chain", many: "Longest chain" },
};

export const TAB_LABELS = { posts: "Posts", photos: "Photos", thoughts: "Thoughts", glows: "Kudos", about: "About" };

export const BLOCKS = {
  pinned_post: { label: "Pinned post", hint: "Keep one post at the top of your profile." },
  featured_photos: { label: "Featured photos", hint: "Show off up to 6 of your photos." },
  about_cards: { label: "About cards", hint: "Currently, ask me about, favourite paddle…" },
  pickleball: { label: "Pickleball card", hint: "Your level, play style and home court." },
  kudos_preview: { label: "Kudos wall", hint: "Your 3 latest kudos as notes." },
  links: { label: "Links", hint: "Instagram, TikTok, your website…" },
  song: { label: "Profile song", hint: "What you've got on repeat." },
  spotlight: { label: "Friend spotlight", hint: "Pin a friend with a short note." },
  visitor_kudos: { label: "Kudos button", hint: "A big “Send kudos” card for visitors." },
};

export const ABOUT_KINDS = { currently: "Currently", ask_me: "Ask me about", paddle: "Favourite paddle", home_court: "Home court", favorite: "Favourite thing" };
export const LINK_KINDS = { instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", facebook: "Facebook", website: "Website" };
export const PLAY_STYLES = { "": "Not set", banger: "Banger", dinker: "Dinker", all_court: "All-court" };
export const LEVELS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

export const COLOR_PARTS = [
  { key: "page", label: "Page background", hint: "Behind your profile card" },
  { key: "card", label: "Profile card", hint: "The main card everything sits on" },
  { key: "inner", label: "Inner cards", hint: "Blocks and posts" },
  { key: "heading", label: "Headings", hint: "Your name and titles" },
  { key: "text", label: "Text", hint: "Bio, captions and details" },
];

export const REWARDS = [
  { setting: "avatar_frame", value: "rising", label: "Rising photo frame" },
  { setting: "name_effect", value: "gold", label: "Gold name" },
  { setting: "avatar_frame", value: "anniversary", label: "Anniversary frame" },
  { setting: "avatar_frame", value: "holiday", label: "Holiday frame" },
];

export const newBlock = (type) =>
  ({
    pinned_post: { type, post_id: null },
    featured_photos: { type, photos: [] },
    about_cards: { type, cards: [{ kind: "currently", text: "" }] },
    pickleball: { type, level: "", style: "", home_court: "", court_url: "" },
    links: { type, links: [{ kind: "instagram", url: "" }] },
    song: { type, title: "", artist: "", url: "" },
    spotlight: { type, account_id: null, note: "" },
  })[type] ?? { type };
