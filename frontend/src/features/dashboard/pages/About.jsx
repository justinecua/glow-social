import { Link } from "react-router-dom";
import { Camera, Compass, Heart, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useStoredUser } from "@/utils/auth";
import LegalLinks from "@/features/legal/components/LegalLinks";
import glow from "@/assets/images/glow.png";

const features = [
  {
    icon: Camera,
    title: "Share moments",
    text: "Post thoughts and photos with the people who matter.",
  },
  {
    icon: Heart,
    title: "Glow what you love",
    text: "A glow is our like: a little spark of appreciation.",
  },
  {
    icon: MessageCircle,
    title: "Talk it out",
    text: "Comment and reply in threads that keep conversations together.",
  },
  {
    icon: UsersRound,
    title: "Make friends",
    text: "Send requests and get real-time notifications.",
  },
  { icon: Compass, title: "Discover", text: "Explore trending posts, photos and new people." },
  {
    icon: ShieldCheck,
    title: "Safe by design",
    text: "Clear community rules, and you control your data.",
  },
];

const About = () => {
  const user = useStoredUser();

  return (
    <AppShell>
      <div className="w-full max-w-xl pt-8">
        <section className="flex flex-col items-center rounded-2xl bg-[var(--home-card)] px-6 py-10 text-center">
          <img src={glow} alt="Glow" className="h-16 w-16" />
          <h1 className="mt-4 text-2xl font-bold text-[var(--title-color)]">
            Glow is your place to vibe with friends
          </h1>
          <p className="mt-2 max-w-md text-sm text-[var(--color-subtitle)]">
            A small, friendly social network for sharing everyday moments, cheering each other on,
            and meeting new people.
          </p>
          {!user && (
            <div className="mt-6 flex w-full max-w-xs flex-col gap-2 sm:flex-row">
              <Button
                asChild
                className="flex-1 bg-[var(--button-color-bg)] text-white hover:opacity-90"
              >
                <Link to="/register">Create account</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/login">Log in</Link>
              </Button>
            </div>
          )}
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl bg-[var(--home-card)] p-5">
              <span className="mb-3 inline-flex rounded-lg bg-[var(--photo-bg)] p-2">
                <Icon className="h-5 w-5 text-[var(--title-color)]" />
              </span>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-[var(--color-subtitle)]">{text}</p>
            </div>
          ))}
        </section>

        <LegalLinks className="mt-6 justify-center pb-6" />
      </div>
    </AppShell>
  );
};

export default About;
