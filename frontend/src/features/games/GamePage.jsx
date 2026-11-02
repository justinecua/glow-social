import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Share2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/features/discover/components/PageHeader";
import PersonRow from "@/features/discover/components/PersonRow";
import { postShareUrl, shareLink } from "@/features/growth/share";
import { useDeletePostMutation } from "@/redux/services/posts/posts";
import {
  useGetGameQuery,
  useJoinGameMutation,
  useLeaveGameMutation,
} from "@/redux/services/games";
import { useAuthChecking, useStoredUser } from "@/utils/auth";
import { useWebSocket } from "@/utils/WebSocketContext";
import SpotsBar from "./SpotsBar";
import GameForm from "./GameForm";
import CourtBanner from "./CourtBanner";
import { courtLinkLabel, levelLabel, whenLabel } from "./gameUtils";
import { useCourtPreview } from "./useCourtPreview";

const linkBtn =
  "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-[var(--photo-bg)]";

const GamePage = () => {
  const { id } = useParams();
  const gameId = Number(id);
  const navigate = useNavigate();
  const user = useStoredUser();
  const checking = useAuthChecking();
  const socketRef = useWebSocket();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const { data: game, isLoading, error, refetch } = useGetGameQuery(gameId, {
    skip: !user || !gameId,
    refetchOnMountOrArgChange: true,
  });
  const preview = useCourtPreview(game?.court_url);
  const [join, { isLoading: joining }] = useJoinGameMutation();
  const [leave, { isLoading: leaving }] = useLeaveGameMutation();
  const [deletePost, { isLoading: canceling }] = useDeletePostMutation();

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;
    const onMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "games_updated" && msg.game_id === gameId) refetch();
      } catch {
        /* ignore non-JSON */
      }
    };
    socket.addEventListener("message", onMessage);
    return () => socket.removeEventListener("message", onMessage);
  }, [socketRef, socketRef?.current, gameId, refetch]);

  if (!user && checking) {
    return (
      <AppShell>
        <Loader2 className="mt-20 animate-spin" />
      </AppShell>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const run = async (action, ok) => {
    try {
      await action().unwrap();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(err?.data?.detail || "Something went wrong. Try again.");
    }
  };

  const onJoin = () =>
    run(() => join(gameId), game.joined_count >= game.capacity ? "You're on the waitlist" : "You're in!");

  const onLeave = async () => {
    await run(() => leave(gameId), "You left the game");
    setLeaveOpen(false);
  };

  const onCancel = async () => {
    try {
      await deletePost({ post_id: game.post_id }).unwrap();
      toast.success("Game canceled");
      navigate("/");
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't cancel the game.");
    }
  };

  const back = (
    <Link
      to={game?.post_id ? `/post/${game.post_id}` : "/"}
      className="mb-2 mt-6 inline-flex items-center gap-1 text-sm text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
    >
      <ArrowLeft className="h-4 w-4" /> {game?.post_id ? "Back to post" : "Home"}
    </Link>
  );

  if (isLoading) {
    return (
      <AppShell>
        <Loader2 className="mt-20 animate-spin" />
      </AppShell>
    );
  }
  if (error || !game) {
    return (
      <AppShell>
        <div className="w-full max-w-xl">
          {back}
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="Game not found"
            text="It may have been canceled by the host."
          />
        </div>
      </AppShell>
    );
  }

  const going = game.players.filter((p) => p.status === "joined");
  const waiting = game.players.filter((p) => p.status === "waitlist");
  const full = game.joined_count >= game.capacity;
  const over = new Date(game.starts_at).getTime() < Date.now() - 3 * 60 * 60 * 1000;

  const primary = (() => {
    if (game.is_host) return null;
    if (game.my_status)
      return (
        <button
          type="button"
          onClick={() => setLeaveOpen(true)}
          disabled={leaving}
          className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md border text-sm font-semibold hover:bg-[var(--photo-bg)] disabled:opacity-60"
        >
          {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : game.my_status === "joined" ? "Leave game" : "Leave waitlist"}
        </button>
      );
    if (over) return null;
    return (
      <button
        type="button"
        onClick={onJoin}
        disabled={joining}
        className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-[var(--button-color-bg)] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : full ? "Join waitlist" : "Join game"}
      </button>
    );
  })();

  return (
    <AppShell>
      <div className="w-full max-w-xl pb-10">
        {back}

        <section className="overflow-hidden rounded-xl bg-[var(--home-card)]">
          {game.court_url && <CourtBanner url={game.court_url} preview={preview} />}
          <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-[var(--title-color)]">{game.title}</h1>
            {game.my_status === "joined" && !game.is_host && (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                You're in
              </span>
            )}
            {game.my_status === "waitlist" && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                Waitlist #{waiting.findIndex((p) => p.id === user.user?.account_id) + 1}
              </span>
            )}
          </div>

          <div className="mt-3 space-y-1.5 text-sm">
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-[var(--color-subtitle)]" /> {whenLabel(game)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-[var(--color-subtitle)]" /> {game.venue}
            </p>
            <p className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 shrink-0 text-[var(--color-subtitle)]" />
              {levelLabel(game)} · {game.courts} {game.courts === 1 ? "court" : "courts"}
            </p>
            <p className={`flex items-center gap-2 ${game.court_booked ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-subtitle)]"}`}>
              {game.court_booked ? <CircleCheck className="h-4 w-4 shrink-0" /> : <CircleDashed className="h-4 w-4 shrink-0" />}
              {game.court_booked ? "Court booked" : "Court not booked yet"}
            </p>
          </div>

          {(game.court_url || game.maps_url) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {game.court_url && (
                <a href={game.court_url} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                  <ExternalLink className="h-4 w-4" /> {courtLinkLabel(game.court_url)}
                </a>
              )}
              {game.maps_url && (
                <a href={game.maps_url} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                  <Navigation className="h-4 w-4" /> Directions
                </a>
              )}
            </div>
          )}

          {game.notes && (
            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-[var(--photo-bg)] p-3 text-sm">{game.notes}</p>
          )}

          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium">
                {game.joined_count}/{game.capacity} joined
              </span>
              {game.waitlist_count > 0 && (
                <span className="text-[var(--color-subtitle)]">{game.waitlist_count} on waitlist</span>
              )}
            </div>
            <SpotsBar joined={game.joined_count} capacity={game.capacity} />
          </div>

          <div className="mt-5 space-y-2">
            {primary}
            {over && !game.my_status && (
              <p className="text-center text-sm text-[var(--color-subtitle)]">This game is over.</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => shareLink(postShareUrl(game.post_id), game.title, `${game.title} · ${whenLabel(game)} · ${game.venue}`)}
                className={`${linkBtn} flex-1 cursor-pointer justify-center`}
              >
                <Share2 className="h-4 w-4" /> Share link
              </button>
              {game.is_host && (
                <button type="button" onClick={() => setEditOpen(true)} className={`${linkBtn} flex-1 cursor-pointer justify-center`}>
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
            </div>
          </div>
          </div>
        </section>

        <h2 className="mb-2 mt-6 text-sm font-semibold">Going ({going.length})</h2>
        <div className="rounded-xl bg-[var(--home-card)] p-1">
          {going.map((p) => (
            <PersonRow key={p.id} person={p} meta={p.id === game.host.id ? "Host" : null} />
          ))}
        </div>

        {waiting.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 text-sm font-semibold">Waitlist ({waiting.length})</h2>
            <div className="rounded-xl bg-[var(--home-card)] p-1">
              {waiting.map((p, i) => (
                <PersonRow key={p.id} person={p} meta={`#${i + 1}`} />
              ))}
            </div>
          </>
        )}

        {game.is_host && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="mt-6 cursor-pointer text-sm font-medium text-red-600 hover:underline"
          >
            Cancel game
          </button>
        )}
      </div>

      {game.is_host && <GameForm open={editOpen} onOpenChange={setEditOpen} game={game} />}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="bg-[var(--home-card)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this game?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone who joined gets notified, and the post is deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onCancel();
              }}
              disabled={canceling}
              className="cursor-pointer bg-red-600 text-white hover:bg-red-700"
            >
              {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel game"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent className="bg-[var(--home-card)]">
          <AlertDialogHeader>
            <AlertDialogTitle>{game.my_status === "joined" ? "Leave this game?" : "Leave the waitlist?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {game.my_status === "joined"
                ? "Your spot goes to the next person on the waitlist."
                : "You'll lose your place in line."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onLeave();
              }}
              disabled={leaving}
              className="cursor-pointer"
            >
              {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default GamePage;
