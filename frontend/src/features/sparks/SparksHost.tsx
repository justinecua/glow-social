import { useEffect, useState } from "react";
import { useGetSparksQuery, type Spark } from "@/redux/services/sparks";
import { useStoredUser } from "@/utils/auth";
import SparkComposer from "./SparkComposer";
import SparkViewer from "./SparkViewer";

/** Mounted once in App: opens the spark viewer / composer from anywhere
 *  (timeline, avatar rings) via window events. */
const SparksHost = () => {
  const user = useStoredUser();
  const { data, refetch } = useGetSparksQuery(undefined, {
    skip: !user,
    pollingInterval: 3 * 60 * 1000, // pick up friends' new sparks
  });
  const [viewer, setViewer] = useState<{ list: Spark[]; start: number } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    const onOpen = async (e: Event) => {
      const { authorId, sparkId } = (e as CustomEvent).detail || {};
      const fresh: any = data ? data : (await refetch()).data;
      const list: Spark[] = fresh?.sparks ?? [];
      if (!list.length) return;
      let start = 0;
      if (sparkId) start = Math.max(0, list.findIndex((s) => s.id === sparkId));
      else if (authorId) {
        const theirs = list.map((s, i) => [s, i] as const).filter(([s]) => s.author.id === authorId);
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
      {viewer && <SparkViewer sparks={viewer.list} startIndex={viewer.start} onClose={() => setViewer(null)} />}
      <SparkComposer open={composerOpen} onOpenChange={setComposerOpen} />
    </>
  );
};

export default SparksHost;
