import { Link } from "react-router-dom";
import NoProfile from "@/assets/images/No-Profile.jpg";

export type Person = {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  profile_photo?: string;
};

const fullName = (p: Person) =>
  [p.firstname, p.lastname].filter(Boolean).join(" ").trim();

export const Avatar = ({
  src,
  alt,
  className = "h-10 w-10",
}: {
  src?: string;
  alt: string;
  className?: string;
}) => (
  <img
    src={src || NoProfile}
    alt={alt}
    loading="lazy"
    decoding="async"
    onError={(e) => {
      if (e.currentTarget.src !== NoProfile) e.currentTarget.src = NoProfile;
    }}
    className={`${className} shrink-0 rounded-full object-cover`}
  />
);

/** A person in a list: avatar, name, @username, optional right-side action. */
const PersonRow = ({
  person,
  meta,
  action,
}: {
  person: Person;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--photo-bg)]">
    <Link to={`/profile/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar src={person.profile_photo} alt={person.username} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {fullName(person) || person.username}
        </p>
        <p className="truncate text-xs text-[var(--color-subtitle)]">
          @{person.username}
          {meta ? <> · {meta}</> : null}
        </p>
      </div>
    </Link>
    {action}
  </div>
);

export default PersonRow;
