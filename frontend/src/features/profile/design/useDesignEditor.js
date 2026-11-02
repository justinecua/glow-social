import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import {
  profileDesignApi,
  useGetMyDesignQuery,
  usePreviewDesignBlocksMutation,
  useSaveMyDesignMutation,
} from "@/redux/services/profileDesign";
import { withDefaults } from "./designStyle";

const needsServerData = (b) =>
  (b.type === "pinned_post" && b.post_id) || (b.type === "spotlight" && b.account_id) || b.type === "featured_photos";

export const useDesignEditor = (profileId) => {
  const [editing, setEditing] = useState(false);
  const [visitor, setVisitor] = useState(false);
  const [draft, setDraft] = useState(null);
  const [history, setHistory] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [savingAction, setSavingAction] = useState(null); // "draft" or "publish", for the right spinner
  const { data: mine } = useGetMyDesignQuery(undefined, { skip: !editing });
  const [save, { isLoading: saving }] = useSaveMyDesignMutation();
  const [preview] = usePreviewDesignBlocksMutation();
  const dispatch = useDispatch();

  if (editing && mine && !draft) setDraft(withDefaults(mine.draft)); // first open: start from the saved draft

  const previewKey = JSON.stringify(draft ? draft.blocks.filter(needsServerData) : null);
  useEffect(() => {
    if (!editing || previewKey === "null") return;
    const t = window.setTimeout(() => {
      preview(JSON.parse(previewKey))
        .unwrap()
        .then(setPreviewData)
        .catch(() => {}); // half-filled blocks just don't preview yet
    }, 400);
    return () => window.clearTimeout(t);
  }, [editing, previewKey, preview]);

  const change = (next) => {
    setHistory((h) => [...h.slice(-49), draft]);
    setDraft(next);
    setDirty(true);
    setError("");
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setDraft(previous);
    setHistory(history.slice(0, -1));
    setDirty(true);
  };

  const persist = async (publish) => {
    setSavingAction(publish ? "publish" : "draft");
    try {
      const saved = await save({ design: draft, publish, profileId }).unwrap();
      if (publish) {
        dispatch( // show the new design right away instead of the old one while the page refetches
          profileDesignApi.util.updateQueryData("getProfileDesign", profileId, (cached) => {
            cached.design = saved.published;
          }),
        );
      }
      setDirty(false);
      return true;
    } catch (err) {
      setError(err?.data?.detail || "Couldn't save your design. Try again.");
      return false;
    } finally {
      setSavingAction(null);
    }
  };

  const stop = () => {
    setEditing(false);
    setVisitor(false);
    setDraft(null);
    setHistory([]);
    setPreviewData(null);
    setError("");
  };

  return {
    editing,
    opening: editing && !draft, // fetching the saved draft before the panel can show
    visitor,
    draft,
    dirty,
    error,
    saving,
    savingAction,
    unlocks: mine?.unlocks,
    previewData,
    canUndo: history.length > 0,
    start: () => setEditing(true),
    change,
    undo,
    reset: () => change(withDefaults({})),
    setVisitor,
    saveDraft: async () => {
      if (await persist(false)) toast.success("Draft saved. Only you can see it.");
    },
    publish: async () => {
      if (await persist(true)) {
        toast.success("Your profile design is live");
        stop();
      }
    },
    close: async () => {
      if (dirty && !(await persist(false))) return; // keep unsaved work as a draft
      stop();
    },
  };
};
