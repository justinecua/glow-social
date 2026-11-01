import { api } from "./auth/token";

const timeout = 60000;

export const sparksApi = api.enhanceEndpoints({ addTagTypes: ["Sparks"] }).injectEndpoints({
  endpoints: (builder) => ({
    // Your Today timeline + per-author ring info. Shared by every avatar ring.
    getSparks: builder.query({
      query: () => ({ url: "sparks/", method: "GET", timeout }),
      providesTags: ["Sparks"],
      keepUnusedDataFor: 300,
    }),
    createSpark: builder.mutation({
      query: (body: { photo?: string; text?: string; background?: string; close_friends_only?: boolean }) => ({
        url: "sparks/",
        method: "POST",
        body,
        timeout,
      }),
      invalidatesTags: ["Sparks"],
    }),
    deleteSpark: builder.mutation({
      query: (id: number) => ({ url: `sparks/${id}/`, method: "DELETE", timeout }),
      invalidatesTags: ["Sparks"],
    }),
    getSparkStats: builder.query({
      query: (id: number) => ({ url: `sparks/${id}/`, method: "GET", timeout }),
    }),
    viewSpark: builder.mutation({
      query: (id: number) => ({ url: `sparks/${id}/view/`, method: "POST", timeout }),
      // Mark seen locally right away so rings dim without a refetch.
      async onQueryStarted(id, { dispatch }) {
        dispatch(
          (sparksApi.util.updateQueryData as any)("getSparks", undefined, (d: any) => markSeen(d, id))
        );
      },
    }),
    warmSpark: builder.mutation({
      query: (id: number) => ({ url: `sparks/${id}/warm/`, method: "POST", timeout }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          (sparksApi.util.updateQueryData as any)("getSparks", undefined, (d: any) => {
            markSeen(d, id);
            const s = d?.sparks?.find((x: any) => x.id === id);
            if (s) s.warmed = true;
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

function markSeen(d: any, id: number) {
  const s = d?.sparks?.find((x: any) => x.id === id);
  if (!s || s.seen) return;
  s.seen = true;
  const a = d.authors?.[s.author.id];
  if (a) a.unseen = d.sparks.some((x: any) => x.author.id === s.author.id && !x.seen);
}

export const {
  useGetSparksQuery,
  useCreateSparkMutation,
  useDeleteSparkMutation,
  useGetSparkStatsQuery,
  useViewSparkMutation,
  useWarmSparkMutation,
} = sparksApi;

export type Spark = {
  id: number;
  author: { id: number; username: string; firstname: string; lastname: string; profile_photo: string };
  photo: string;
  text: string;
  background: string;
  close_friends_only: boolean;
  created_at: string;
  expires_at: string;
  seen: boolean;
  warmed: boolean;
  mine: boolean;
  views: number | null;
  warms: number | null;
};

/** Text-spark backgrounds (keys match the server). */
export const SPARK_BACKGROUNDS: Record<string, string> = {
  sunrise: "linear-gradient(135deg,#ff9a5a,#ff5f8f)",
  ocean: "linear-gradient(135deg,#3a7bfd,#22c1c3)",
  forest: "linear-gradient(135deg,#1f9d6b,#9be15d)",
  dusk: "linear-gradient(135deg,#6a3df0,#e44fa6)",
  ember: "linear-gradient(135deg,#f5b02e,#e2463a)",
  night: "linear-gradient(135deg,#1b2048,#4a3a8f)",
};

/** Ask the global viewer (SparksHost) to open. */
export const openSparks = (detail: { authorId?: number; sparkId?: number; fromTime?: number }) =>
  window.dispatchEvent(new CustomEvent("glow:open-sparks", { detail }));
export const openSparkComposer = () => window.dispatchEvent(new CustomEvent("glow:new-spark"));
