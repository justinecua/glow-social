import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUpdateGameMutation } from "@/redux/services/games";
import GameFields from "./GameFields";
import { blankGame, formToGame, gameFormReady, gameToForm } from "./gameUtils";

const GameForm = ({ open, onOpenChange, game }) => {
  const [form, setForm] = useState(blankGame);
  const [updateGame, { isLoading }] = useUpdateGameMutation();

  useEffect(() => {
    if (open) setForm(gameToForm(game));
  }, [open, game]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await updateGame({ id: game.id, ...formToGame(form) }).unwrap();
      toast.success("Game updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.data?.detail || "Couldn't save the game. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-[var(--home-card)] sm:max-w-lg">
        <DialogTitle>Edit game</DialogTitle>
        <form onSubmit={submit} className="space-y-4">
          <GameFields form={form} onChange={setForm} />
          <button
            type="submit"
            disabled={isLoading || !gameFormReady(form)}
            className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-[var(--button-color-bg)] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GameForm;
