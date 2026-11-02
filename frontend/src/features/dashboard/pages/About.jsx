import { Link } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Compass,
  Diamond,
  HandHeart,
  Lock,
  MessageCircle,
  ShieldCheck,
  Star,
  Sun,
  UsersRound,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useStoredUser } from "@/utils/auth";
import GlowLogo from "@/components/layout/GlowLogo";

// Same soft brand glow as an empty profile cover.
const GLOW_BG =
  "radial-gradient(90% 120% at 0% 0%, color-mix(in srgb, var(--button-color-bg) 40%, transparent) 0%, transparent 60%)," +
  "radial-gradient(90% 120% at 100% 100%, color-mix(in srgb, #ff5fa2 28%, transparent) 0%, transparent 60%)," +
  "var(--home-card)";

/* ---------- tiny previews of the real UI ---------- */

const SparksPreview = () => (
  <div className="flex items-end gap-2" aria-hidden>
    {[
      ["linear-gradient(135deg,#ff9a5a,#ff5f8f)", "8:12am", "#7b6dff"],
      ["linear-gradient(135deg,#3a7bfd,#22c1c3)", "12:40pm", "#f5a524"],
      ["linear-gradient(135deg,#6a3df0,#e44fa6)", "6:05pm", "#7b6dff"],
    ].map(([bg, time, ring], i) => (
      <div key={time} className="flex flex-col items-center gap-1">
        <span
          className="block h-16 w-11 rounded-lg"
          style={{ background: bg, boxShadow: `0 0 0 2px ${ring}, 0 0 12px ${ring}66`, opacity: 1 - i * 0.12 }}
        />
        <span className="text-[9px] text-[var(--color-subtitle)]">{time}</span>
      </div>
    ))}
  </div>
);

const KudosPreview = () => (
  <div className="w-44 rounded-xl border bg-[var(--background)] p-3 text-xs" aria-hidden>
    <p className="leading-snug">“Thanks for always being there 🙏”</p>
    <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--color-subtitle)]">
      <span className="h-4 w-4 rounded-full bg-[var(--photo-bg)]" /> @your_friend
    </p>
  </div>
);

const PollPreview = () => (
  <div className="flex w-44 flex-col gap-1.5 text-[11px]" aria-hidden>
    {[
      ["Sinigang", 62, true],
      ["Adobo", 38, false],
    ].map(([label, pct, mine]) => (
      <div key={label} className="relative h-7 overflow-hidden rounded-md">
        <div
          className="absolute inset-y-0 left-0 rounded-md"
          style={{
            width: `${pct}%`,
            background: mine
              ? "color-mix(in srgb, var(--button-color-bg) 30%, transparent)"
              : "var(--button-hover-bg-color)",
          }}
        />
        <div className="relative flex h-full items-center justify-between px-2">
          <span className={mine ? "font-semibold" : ""}>{label}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
      </div>
    ))}
  </div>
);

const signature = [
  {
    icon: Sun,
    kicker: "Sparks",
    title: "Your friends' day, in order",
    text: "Share a moment that fades after 24 hours. Instead of one person at a time, Sparks play your whole circle's day from morning to night. Hold one to brighten it.",
    preview: <SparksPreview />,
  },
  {
    icon: HandHeart,
    kicker: "Glows & Kudos",
    title: "Appreciation, not just likes",
    text: "Glow a post you love, or send someone Kudos: a short note about why they matter. Kudos can be passed on, starting chains of kindness.",
    preview: <KudosPreview />,
  },
  {
    icon: BarChart3,
    kicker: "Prompts & polls",
    title: "Always something to talk about",
    text: "A new prompt or photo challenge every day (#FoodFriday, #OOTD) and quick polls that anyone can answer in a tap.",
    preview: <PollPreview />,
  },
];

const more = [
  { icon: MessageCircle, title: "Messages", text: "Private chats and group chats with friends." },
  { icon: Star, title: "Close friends", text: "Share some posts and sparks with your inner circle only." },
  { icon: Compass, title: "Discover", text: "Trending posts, photos, tags and new people." },
  { icon: UsersRound, title: "People you may know", text: "Suggestions based on mutual friends." },
  { icon: Bell, title: "Stay in the loop", text: "Real-time notifications and a daily friends digest." },
  { icon: Diamond, title: "Daily content", text: "Trends, weather, trivia and more from our labelled bots." },
];

const values = [
  { icon: UsersRound, text: "Friends first: their posts come before everything else." },
  { icon: ShieldCheck, text: "Automated accounts are always labelled." },
  { icon: Lock, text: "Your data is yours: download or delete it anytime." },
];

const About = () => {
  const user = useStoredUser();

  return (
    <AppShell>
      <div className="w-full max-w-xl px-1 pb-8 pt-6">
        {/* Hero */}
        <section
          className="overflow-hidden rounded-2xl border px-6 py-10 text-center"
          style={{ background: GLOW_BG }}
        >
          <GlowLogo className="mx-auto h-14 w-14 drop-shadow-[0_0_18px_rgba(91,124,255,0.55)]" />
          <h1 className="mx-auto mt-5 max-w-sm text-[26px] font-bold leading-tight text-[var(--title-color)]">
            A friendlier place to share your day
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--color-subtitle)]">
            Glow is a small social network built around your friends: everyday moments, kind words,
            and a feed that shows you something new every visit.
          </p>
          <div className="mx-auto mt-7 flex max-w-xs flex-col gap-2 sm:flex-row">
            {user ? (
              <Button asChild className="flex-1 rounded-full bg-[var(--button-color-bg)] text-white hover:opacity-90">
                <Link to="/">Back to your feed</Link>
              </Button>
            ) : (
              <>
                <Button asChild className="flex-1 rounded-full bg-[var(--button-color-bg)] text-white hover:opacity-90">
                  <Link to="/register">Create account</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 rounded-full bg-transparent">
                  <Link to="/login">Log in</Link>
                </Button>
              </>
            )}
          </div>
        </section>

        {/* Signature features */}
        <h2 className="mb-3 mt-10 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-subtitle)]">
          What makes Glow different
        </h2>
        <div className="flex flex-col gap-3">
          {signature.map(({ icon: Icon, kicker, title, text, preview }) => (
            <section
              key={kicker}
              className="flex flex-col gap-5 rounded-2xl border bg-[var(--home-card)] p-5 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--button-color-bg)] dark:text-[#a99fff]">
                  <Icon className="h-3.5 w-3.5" />
                  {kicker}
                </p>
                <h3 className="mt-1 text-base font-semibold text-[var(--title-color)]">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-subtitle)]">{text}</p>
              </div>
              <div className="flex shrink-0 justify-center rounded-xl bg-[var(--photo-bg)] p-4 sm:w-52">
                {preview}
              </div>
            </section>
          ))}
        </div>

        {/* Everything else */}
        <h2 className="mb-1 mt-10 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-subtitle)]">
          Also on Glow
        </h2>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {more.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 border-b px-1 py-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-subtitle)]" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-sm text-[var(--color-subtitle)]">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* What we stand for */}
        <section className="mt-10 rounded-2xl bg-[var(--home-card)] p-5">
          <h2 className="text-sm font-semibold">What we stand for</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {values.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-sm text-[var(--color-subtitle)]">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--button-color-bg)] dark:text-[#a99fff]" />
                {text}
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-8 text-center text-xs text-[var(--color-subtitle)]">
          Developed by <span className="font-medium text-[var(--title-color)]">Justine Cua</span>
        </p>
      </div>
    </AppShell>
  );
};

export default About;
