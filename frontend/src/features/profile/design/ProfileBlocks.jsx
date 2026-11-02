import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AtSign,
  Clock,
  ExternalLink,
  Globe,
  Heart,
  MapPin,
  MessageCircleQuestion,
  Music,
  Pin,
  Star,
  Trophy,
} from "lucide-react";
import { Avatar } from "@/features/discover/components/PersonRow";
import PostCard from "@/features/discover/components/PostCard";
import SendGlowDialog from "@/features/glows/SendGlowDialog";
import { useGetGlowWallQuery } from "@/redux/services/growth";
import { useStoredUser } from "@/utils/auth";
import { ABOUT_KINDS, LINK_KINDS, PLAY_STYLES } from "./options";

const ABOUT_ICONS = { currently: Clock, ask_me: MessageCircleQuestion, paddle: Trophy, home_court: MapPin, favorite: Heart };

const nameOf = (p) => [p.firstname, p.lastname].filter(Boolean).join(" ") || p.username;

const Block = ({ title, icon: Icon, children, className = "" }) => (
  <section className={`pf-card border bg-[var(--pf-inner,var(--home-card))] p-4 ${className}`}>
    {title && (
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtitle)]">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </h3>
    )}
    {children}
  </section>
);

const PinnedPost = ({ post }) =>
  post ? (
    <div>
      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtitle)]">
        <Pin className="h-3.5 w-3.5" /> Pinned
      </p>
      <PostCard post={post} />
    </div>
  ) : null;

const FeaturedPhotos = ({ photos }) =>
  photos?.length ? (
    <Block title="Featured" icon={Star}>
      <div className={`grid gap-2 ${photos.length === 4 ? "grid-cols-2" : "grid-cols-3"}`}>
        {photos.map((src) => (
          <img key={src} src={src} alt="" loading="lazy" className="pf-card aspect-square w-full object-cover" />
        ))}
      </div>
    </Block>
  ) : null;

const AboutCards = ({ cards }) =>
  cards?.length ? (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c, i) => {
        const Icon = ABOUT_ICONS[c.kind] ?? Star;
        return (
          <Block key={i}>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-subtitle)]">
              <Icon className="h-3.5 w-3.5 text-[var(--button-color-bg)]" /> {ABOUT_KINDS[c.kind]}
            </p>
            <p className="mt-1.5 text-[15px] font-medium">{c.text}</p>
          </Block>
        );
      })}
    </div>
  ) : null;

const Pickleball = ({ block }) => (
  <Block title="Pickleball" icon={Trophy}>
    <div className="flex flex-wrap gap-3">
      {block.level && (
        <div className="pf-card min-w-24 flex-1 bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] p-3">
          <p className="text-xs text-[var(--color-subtitle)]">Level</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--title-color)]">{block.level}</p>
        </div>
      )}
      {block.style && (
        <div className="pf-card min-w-24 flex-1 bg-[color-mix(in_srgb,var(--button-color-bg)_10%,transparent)] p-3">
          <p className="text-xs text-[var(--color-subtitle)]">Play style</p>
          <p className="text-lg font-semibold">{PLAY_STYLES[block.style]}</p>
        </div>
      )}
    </div>
    {block.home_court && (
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <MapPin className="h-4 w-4 text-[var(--color-subtitle)]" /> Home court: <span className="font-medium">{block.home_court}</span>
        {block.court_url && (
          <a
            href={block.court_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-[var(--button-color-bg)] hover:underline"
          >
            Book <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </p>
    )}
  </Block>
);

const KudosPreview = ({ profileId }) => {
  const { data } = useGetGlowWallQuery({ account_id: Number(profileId) });
  const notes = (data?.notes ?? []).slice(0, 3);
  if (!notes.length) return null;
  return (
    <Block title="Kudos" icon={Heart}>
      <div className="grid gap-3 sm:grid-cols-3">
        {notes.map((n, i) => (
          <Link
            key={n.id}
            to="?tab=glows"
            className="pf-card block bg-[color-mix(in_srgb,var(--button-color-bg)_10%,var(--home-card))] p-3 text-sm transition-transform hover:-translate-y-0.5"
            style={{ rotate: `${[-1, 0.8, -0.4][i]}deg` }}
          >
            <p className="line-clamp-3 font-medium">{n.message}</p>
            <p className="mt-2 text-xs text-[var(--color-subtitle)]">@{n.sender.username}</p>
          </Link>
        ))}
      </div>
    </Block>
  );
};

const Links = ({ links }) =>
  links?.length ? (
    <Block title="Links" icon={AtSign}>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-[var(--photo-bg)]"
          >
            {l.kind === "website" ? <Globe className="h-4 w-4" /> : <AtSign className="h-4 w-4" />}
            {LINK_KINDS[l.kind]}
          </a>
        ))}
      </div>
    </Block>
  ) : null;

const Song = ({ block }) => {
  const body = (
    <div className="flex items-center gap-3">
      <span className="pf-card flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--button-color-bg)] text-white">
        <Music className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">{block.title}</p>
        {block.artist && <p className="truncate text-sm text-[var(--color-subtitle)]">{block.artist}</p>}
      </div>
      {block.url && <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-[var(--color-subtitle)]" />}
    </div>
  );
  return (
    <Block title="On repeat" icon={Music}>
      {block.url ? (
        <a href={block.url} target="_blank" rel="noopener noreferrer nofollow" className="block hover:opacity-90">
          {body}
        </a>
      ) : (
        body
      )}
    </Block>
  );
};

const Spotlight = ({ friend, note }) =>
  friend ? (
    <Block title="Spotlight" icon={Star}>
      <Link to={`/profile/${friend.id}`} className="flex items-center gap-3 hover:opacity-90">
        <Avatar src={friend.profile_photo} alt={friend.username} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{nameOf(friend)}</p>
          {note && <p className="text-sm text-[var(--color-subtitle)]">{note}</p>}
        </div>
      </Link>
    </Block>
  ) : null;

const VisitorKudos = ({ profile, isOwn }) => {
  const me = useStoredUser();
  const [open, setOpen] = useState(false);
  const name = profile.firstname || profile.username;
  return (
    <Block className="bg-[color-mix(in_srgb,var(--button-color-bg)_10%,var(--home-card))]">
      <div className="flex flex-wrap items-center gap-3">
        <Heart className="h-6 w-6 shrink-0 text-[var(--button-color-bg)]" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Appreciate {name}?</p>
          <p className="text-sm text-[var(--color-subtitle)]">Send them kudos. It may get passed along a chain.</p>
        </div>
        {isOwn ? (
          <span className="text-xs text-[var(--color-subtitle)]">Visitors see a Send kudos button here</span>
        ) : me ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-9 cursor-pointer rounded-full bg-[var(--button-color-bg)] px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            Send kudos
          </button>
        ) : (
          <Link to="/register" className="h-9 rounded-full border px-4 text-sm font-semibold leading-9">
            Join to send kudos
          </Link>
        )}
      </div>
      {!isOwn && me && <SendGlowDialog open={open} onOpenChange={setOpen} recipient={profile} />}
    </Block>
  );
};

const ProfileBlocks = ({ blocks, data, profile, isOwn }) => {
  if (!blocks?.length) return null;
  return (
    <div className="mt-5 grid gap-3 px-4 sm:px-6">
      {blocks.map((block) => {
        switch (block.type) {
          case "pinned_post":
            return <PinnedPost key={block.type} post={data?.pinned_post} />;
          case "featured_photos":
            return <FeaturedPhotos key={block.type} photos={data?.featured_photos} />;
          case "about_cards":
            return <AboutCards key={block.type} cards={block.cards?.filter((c) => c.text?.trim())} />;
          case "pickleball":
            return block.level || block.style || block.home_court ? <Pickleball key={block.type} block={block} /> : null;
          case "kudos_preview":
            return <KudosPreview key={block.type} profileId={profile.id} />;
          case "links":
            return <Links key={block.type} links={block.links?.filter((l) => l.url?.trim())} />;
          case "song":
            return block.title ? <Song key={block.type} block={block} /> : null;
          case "spotlight":
            return <Spotlight key={block.type} friend={data?.spotlight} note={block.note} />;
          case "visitor_kudos":
            return <VisitorKudos key={block.type} profile={profile} isOwn={isOwn} />;
          default:
            return null;
        }
      })}
    </div>
  );
};

export default ProfileBlocks;
