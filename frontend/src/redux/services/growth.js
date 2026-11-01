import { api } from "./auth/token";

const timeout = 60000;

// Pass the Glow, invites, onboarding and single posts.
export const growthApi = api
  .enhanceEndpoints({ addTagTypes: ["GlowWall", "GlowStatus", "Onboarding"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      // ---- Pass the Glow
      getGlowWall: builder.query({
        query: ({ account_id }) => ({ url: `glows/wall/${account_id}/`, timeout }),
        providesTags: (_r, _e, { account_id }) => [{ type: "GlowWall", id: String(account_id) }],
      }),
      getGlowChain: builder.query({
        query: ({ note_id }) => ({ url: `glows/chain/${note_id}/`, timeout }),
      }),
      getMyGlowStatus: builder.query({
        query: () => ({ url: "glows/me/", timeout }),
        providesTags: ["GlowStatus"],
      }),
      getWeeklyGlows: builder.query({
        query: () => ({ url: "glows/weekly/", timeout }),
      }),
      sendGlowNote: builder.mutation({
        query: (body) => ({ url: "glows/send/", method: "POST", body, timeout }),
        invalidatesTags: (_r, _e, { recipient_id }) => [
          { type: "GlowWall", id: String(recipient_id) },
          "GlowStatus",
        ],
      }),

      // ---- Invites
      getInviteInfo: builder.query({
        query: ({ username }) => ({
          url: `accounts/invite/${encodeURIComponent(username)}/`,
          timeout,
        }),
      }),
      getMyInvites: builder.query({
        query: () => ({ url: "accounts/myInvites/", timeout }),
      }),

      // ---- Feed helpers
      getOnboarding: builder.query({
        query: () => ({ url: "accounts/onboarding/", timeout }),
        providesTags: ["Onboarding"],
      }),
      getPost: builder.query({
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
