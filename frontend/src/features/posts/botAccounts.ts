import GlowTrendsLogo from "@/assets/images/glow-trends.svg";
import GlowHistoryLogo from "@/assets/images/glow-history.svg";
import GlowTriviaLogo from "@/assets/images/glow-trivia.svg";
import GlowQuotesLogo from "@/assets/images/glow-quotes.svg";
import GlowJokesLogo from "@/assets/images/glow-jokes.svg";
import GlowPhotosLogo from "@/assets/images/glow-photos.svg";
import GlowLearnLogo from "@/assets/images/glow-learn.svg";
import GlowDogsLogo from "@/assets/images/glow-dogs.svg";
import GlowCatsLogo from "@/assets/images/glow-cats.svg";
import GlowSpaceLogo from "@/assets/images/glow-space.svg";
import GlowPilipinasLogo from "@/assets/images/glow-pilipinas.svg";

/** Logos for Glow's own automated accounts, keyed by username. */
const BOT_LOGOS: Record<string, string> = {
  glow_trends: GlowTrendsLogo,
  glow_history: GlowHistoryLogo,
  glow_trivia: GlowTriviaLogo,
  glow_quotes: GlowQuotesLogo,
  glow_jokes: GlowJokesLogo,
  glow_photos: GlowPhotosLogo,
  glow_learn: GlowLearnLogo,
  glow_dogs: GlowDogsLogo,
  glow_cats: GlowCatsLogo,
  glow_space: GlowSpaceLogo,
  glow_pilipinas: GlowPilipinasLogo,
};

/** The photo to show for an account: its bot logo if it has one. */
export const accountPhoto = (a: { username?: string; is_bot?: boolean; profile_photo?: string } | null | undefined) =>
  (a?.is_bot && a.username && BOT_LOGOS[a.username]) || a?.profile_photo || "";
