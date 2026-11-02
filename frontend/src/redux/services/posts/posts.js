import { api } from "../auth/token";

const timeout = 60000;

export const receivedApi = api
  .enhanceEndpoints({ addTagTypes: ["Posts"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getLinkPreview: builder.query({
        query: (url) => ({
          url: `posts/linkPreview/?url=${encodeURIComponent(url)}`,
          method: "GET",
          timeout: 10000,
        }),
        keepUnusedDataFor: 3600,
      }),
      getPosts: builder.query({
        query: ({ offset = 0, limit = 5, seed }) => ({
          url: `posts/getPosts/?offset=${offset}&limit=${limit}${seed ? `&seed=${seed}` : ""}`,
          method: "GET",
          timeout,
        }),
        providesTags: ["Posts"],
        transformResponse: (response) => response,
        transformErrorResponse: (response) => response,
      }),
      // Posts shared since the feed was opened (for the "New posts" pill).
      getNewPostsCount: builder.query({
        query: ({ seed }) => ({
          url: `posts/new/?seed=${seed}`,
          method: "GET",
          timeout,
        }),
      }),
      // Posts that appeared on screen, so the feed can show new ones next time.
      markSeen: builder.mutation({
        query: (ids) => ({
          url: `posts/seen/`,
          method: "POST",
          body: { ids },
          timeout,
        }),
      }),
      votePoll: builder.mutation({
        query: ({ post_id, option_id }) => ({
          url: `posts/${post_id}/vote/`,
          method: "POST",
          body: { option_id },
          timeout,
        }),
      }),
      getTodayPrompt: builder.query({
        query: () => ({ url: `posts/prompt/today/`, method: "GET", timeout }),
        keepUnusedDataFor: 300,
      }),
      getComments: builder.query({
        query: ({ post_id }) => ({
          url: `interactions/showComments/${post_id}`,
          method: "GET",
          timeout,
        }),
        transformResponse: (response) => response,
        transformErrorResponse: (response) => response,
      }),
      getPostsByUser: builder.query({
        // First page: { account_id }. Later pages: { account_id, before: next }.
        query: ({ account_id, before }) => ({
          url: `posts/getPostsByUser/${account_id}${
            before ? `?before=${encodeURIComponent(before)}` : ""
          }`,
          method: "GET",
          timeout,
        }),
        providesTags: ["Posts"],
        transformResponse: (response) => response,
        transformErrorResponse: (response) => response,
      }),
      getTotalGlowsPostByUser: builder.query({
        query: ({ account_id }) => ({
          url: `/accounts/getTotalGlowsByUser/${account_id}`,
          method: "GET",
          timeout,
        }),
        transformResponse: (response) => response,
        transformErrorResponse: (response) => response,
      }),
      createPost: builder.mutation({
        query: (body) => ({
          url: `/posts/createPost/`,
          method: "POST",
          body: body,
          timeout,
        }),
        // Cached feed / profile pages refetch, so the new post shows up
        // even if it was created while those pages weren't mounted.
        invalidatesTags: ["Posts"],
        transformResponse: (response) => response,
        transformErrorResponse: (response) => response,
      }),
      updatePost: builder.mutation({
        query: ({ post_id, ...body }) => ({
          url: `/posts/post/${post_id}/manage/`,
          method: "PATCH",
          body,
          timeout,
        }),
      }),
      deletePost: builder.mutation({
        query: ({ post_id }) => ({
          url: `/posts/post/${post_id}/manage/`,
          method: "DELETE",
          timeout,
        }),
      }),
      sendGlow: builder.mutation({
        query: (body) => ({
          url: `/posts/sendGlow/`,
          method: "POST",
          body: body,
          timeout,
        }),
        transformResponse: (response) => response,
        transformErrorResponse: (response) => response,
      }),
      sendunGlow: builder.mutation({
        query: (body) => ({
          url: `/posts/sendUnglow/`,
          method: "POST",
          body: body,
          timeout,
        }),
        transformResponse: (response) => response,
        transformErrorResponse: (response) => response,
      }),
    }),
  });

export const {
  useGetLinkPreviewQuery,
  useGetPostsQuery,
  useVotePollMutation,
  useGetTodayPromptQuery,
  useGetCommentsQuery,
  useGetPostsByUserQuery,
  useLazyGetPostsByUserQuery,
  useGetTotalGlowsPostByUserQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useSendGlowMutation,
  useSendunGlowMutation,
} = receivedApi;
