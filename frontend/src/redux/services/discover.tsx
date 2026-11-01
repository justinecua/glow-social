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
  }),
});

export const {
  useGetExploreQuery,
  useGetPostsByTagQuery,
  useSearchQuery,
  useGetMyFriendsQuery,
} = discoverApi;
