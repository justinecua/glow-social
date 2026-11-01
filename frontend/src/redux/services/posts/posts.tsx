import { api } from "../auth/token";

const timeout = 60000;

export const receivedApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPosts: builder.query({
      query: ({ offset = 0, limit = 5 }) => ({
        url: `posts/getPosts/?offset=${offset}&limit=${limit}`,
        method: "GET",
        timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
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
      query: ({ account_id }) => ({
        url: `posts/getPostsByUser/${account_id}`,
        method: "GET",
        timeout,
      }),
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
  useGetPostsQuery,
  useGetCommentsQuery,
  useGetPostsByUserQuery,
  useGetTotalGlowsPostByUserQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useSendGlowMutation,
  useSendunGlowMutation,
} = receivedApi;
