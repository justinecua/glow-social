import { api } from "./auth/token";

const timeout = 60000;

// Pass the Glow, invites, onboarding and single posts.
export const growthApi = api
  .enhanceEndpoints({ addTagTypes: ["GlowWall", "GlowStatus", "Onboarding"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      // ---- Pass the Glow
      getGlowWall: builder.query<any, { account_id: number | string }>({
        query: ({ account_id }) => ({ url: `glows/wall/${account_id}/`, timeout }),
        providesTags: (_r, _e, { account_id }) => [
          { type: "GlowWall", id: String(account_id) },
        ],
      }),
      getGlowChain: builder.query<any, { note_id: number }>({
        query: ({ note_id }) => ({ url: `glows/chain/${note_id}/`, timeout }),
      }),
      getMyGlowStatus: builder.query<any, void>({
        query: () => ({ url: "glows/me/", timeout }),
        providesTags: ["GlowStatus"],
      }),
      getWeeklyGlows: builder.query<any, void>({
        query: () => ({ url: "glows/weekly/", timeout }),
      }),
      sendGlowNote: builder.mutation<any, { recipient_id: number; message: string }>({
        query: (body) => ({ url: "glows/send/", method: "POST", body, timeout }),
        invalidatesTags: (_r, _e, { recipient_id }) => [
          { type: "GlowWall", id: String(recipient_id) },
          "GlowStatus",
        ],
      }),

      // ---- Invites
      getInviteInfo: builder.query<any, { username: string }>({
        query: ({ username }) => ({
          url: `accounts/invite/${encodeURIComponent(username)}/`,
          timeout,
        }),
      }),
      getMyInvites: builder.query<any, void>({
        query: () => ({ url: "accounts/myInvites/", timeout }),
      }),

      // ---- Feed helpers
      getOnboarding: builder.query<any, void>({
        query: () => ({ url: "accounts/onboarding/", timeout }),
        providesTags: ["Onboarding"],
      }),
      getPost: builder.query<any, { post_id: number | string }>({
        query: ({ post_id }) => ({ url: `posts/post/${post_id}/`, timeout }),
      }),
    }),
  });

export const {
  useGetGlowWallQuery,
  useGetGlowChainQuery,
  useGetMyGlowStatusQuery,
  useGetWeeklyGlowsQuery,
  useSendGlowNoteMutation,
  useGetInviteInfoQuery,
  useGetMyInvitesQuery,
  useGetOnboardingQuery,
  useGetPostQuery,
} = growthApi;
