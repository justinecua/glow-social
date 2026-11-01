import { api } from "./auth/token";

const timeout = 60000;

// Explore, search and friends: all built from Glow's own data.
export const discoverApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getExplore: builder.query({
      query: () => ({ url: "posts/explore/", method: "GET", timeout }),
      keepUnusedDataFor: 120,
    }),
    getPostsByTag: builder.query({
      query: ({ tag }) => ({
        url: `posts/explore/?tag=${encodeURIComponent(tag)}`,
        method: "GET",
        timeout,
      }),
    }),
    search: builder.query({
      query: ({ q }) => ({
        url: `posts/search/?q=${encodeURIComponent(q)}`,
        method: "GET",
        timeout,
      }),
    }),
    getMyFriends: builder.query({
      query: () => ({ url: "friends/mine/", method: "GET", timeout }),
    }),
    // Add/remove someone on your Close Friends list (optimistic).
    setCloseFriend: builder.mutation({
      query: ({ account_id, close }: { account_id: number; close: boolean }) => ({
        url: `friends/closeFriends/${account_id}/`,
        method: close ? "POST" : "DELETE",
        timeout,
      }),
      async onQueryStarted({ account_id, close }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          (discoverApi.util.updateQueryData as any)("getMyFriends", undefined, (draft: any) => {
            const f = draft?.friends?.find((x: any) => x.id === account_id);
            if (f) f.is_close = close;
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

export const {
  useGetExploreQuery,
  useGetPostsByTagQuery,
  useSearchQuery,
  useGetMyFriendsQuery,
  useSetCloseFriendMutation,
} = discoverApi;
