import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, CircleCheck, Loader2, MapPin, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useJoinGameMutation } from "@/redux/services/games";
import { useStoredUser } from "@/utils/auth";
import SpotsBar from "./SpotsBar";
import CourtBanner, { CourtLinkButton } from "./CourtBanner";
import { levelLabel, whenLabel } from "./gameUtils";
import { useCourtPreview } from "./useCourtPreview";

const isOver = (game) => new Date(game.starts_at).getTime() < Date.now() - 3 * 60 * 60 * 1000;

const GameCard = ({ game: initial }) => {
  const [game, setGame] = useState(initial);
  const [join, { isLoading }] = useJoinGameMutation();
  const user = useStoredUser();
  const navigate = useNavigate();
  const preview = useCourtPreview(game.court_url);
  useEffect(() => setGame(initial), [initial]);

  const full = game.joined_count >= game.capacity;
  const over = isOver(game);

  const onJoin = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      const updated = await join(game.id).unwrap();
      setGame(updated);
      toast.success(updated.my_status === "joined" ? "You're in!" : "You're on the waitlist");
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't join. Try again.");
    }
  };

  const action = (() => {
    if (game.is_host)
      return <span className="text-sm font-medium text-[var(--button-color-bg)] dark:text-white">You're hosting</span>;
    if (game.my_status === "joined")
      return (
        <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <CircleCheck className="h-4 w-4" /> You're in
        </span>
      );
    if (game.my_status === "waitlist")
      return <span className="text-sm font-medium text-amber-600 dark:text-amber-400">On the waitlist</span>;
    if (over) return <span className="text-sm text-[var(--color-subtitle)]">This game is over</span>;
    return (
      <button
        type="button"
        onClick={onJoin}
        disabled={isLoading}
        className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-[var(--button-color-bg)] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {full ? "Join waitlist" : "Join game"}
      </button>
    );
  })();

  return (
    <div className="mt-3 overflow-hidden rounded-xl border">
      {game.court_url && <CourtBanner url={game.court_url} preview={preview} />}
      <div className="p-4">
      <p className="font-semibold">{game.title}</p>
      <div className="mt-2 space-y-1 text-sm text-[var(--color-subtitle)]">
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" /> {whenLabel(game)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{game.venue}</span>
          {game.court_booked && (
            <span className="flex shrink-0 items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CircleCheck className="h-3.5 w-3.5" /> Booked
            </span>
          )}
        </p>
        <p className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 shrink-0" />
          {game.joined_count}/{game.capacity} going · {levelLabel(game)}
          {game.waitlist_count > 0 && <> · {game.waitlist_count} waiting</>}
        </p>
      </div>

      <div className="mt-3">
        <SpotsBar joined={game.joined_count} capacity={game.capacity} />
      </div>

      {game.court_url && !preview.loading && !preview.image && (
        <CourtLinkButton url={game.court_url} className="mt-3" />
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        {action}
        <Link to={`/games/${game.id}`} className="text-sm font-medium text-[var(--color-subtitle)] hover:text-[var(--title-color)] hover:underline">
          See who's going
        </Link>
      </div>
      </div>
    </div>
  );
};

export default GameCard;
