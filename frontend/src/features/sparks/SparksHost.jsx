import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { sparksApi, useGetSparksQuery } from "@/redux/services/sparks";
import { useStoredUser } from "@/utils/auth";
import SparkComposer from "./SparkComposer";
import SparkViewer from "./SparkViewer";

/** Mounted once in App: opens the spark viewer / composer from anywhere
 *  (timeline, avatar rings) via window events. */
const SparksHost = () => {
  const user = useStoredUser();
  const { data, refetch } = useGetSparksQuery(undefined, {
    skip: !user,
    // Friends' new sparks arrive instantly over the WebSocket (below);
    // this slow poll is only a fallback if the connection drops.
    pollingInterval: 10 * 60 * 1000,
  });
  const [viewer, setViewer] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const dispatch = useDispatch();

  // A friend posted or deleted a spark: refetch Today.
  useEffect(() => {
    const onEvent = (e) => {
      if (e.detail?.type === "sparks_updated")
        dispatch(sparksApi.util.invalidateTags(["Sparks"]));
    };
    window.addEventListener("glow:ws", onEvent);
    return () => window.removeEventListener("glow:ws", onEvent);
  }, [dispatch]);

  useEffect(() => {
    const onOpen = async (e) => {
      const { authorId, sparkId } = e.detail || {};
      const fresh = data ? data : (await refetch()).data;
      const list = fresh?.sparks ?? [];
      if (!list.length) return;
      let start = 0;
      if (sparkId)
        start = Math.max(
          0,
          list.findIndex((s) => s.id === sparkId),
        );
      else if (authorId) {
        const theirs = list
          .map((s, i) => [s, i])
          .filter(([s]) => s.author.id === authorId);
        if (!theirs.length) return;
        start = (theirs.find(([s]) => !s.seen) ?? theirs[0])[1];
      }
      setViewer({ list, start });
    };
    const onNew = () => setComposerOpen(true);
    window.addEventListener("glow:open-sparks", onOpen);
    window.addEventListener("glow:new-spark", onNew);
    return () => {
      window.removeEventListener("glow:open-sparks", onOpen);
      window.removeEventListener("glow:new-spark", onNew);
    };
  }, [data, refetch]);

  if (!user) return null;
  return (
    <>
      {viewer && (
        <SparkViewer
          sparks={viewer.list}
          startIndex={viewer.start}
          onClose={() => setViewer(null)}
        />
      )}
      <SparkComposer open={composerOpen} onOpenChange={setComposerOpen} />
    </>
  );
};

export default SparksHost;
