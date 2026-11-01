import { api } from "../auth/token";

const timeout = 60000;

export const receivedApi = api.injectEndpoints({
  endpoints: (builder) => ({
    addComment: builder.mutation({
      // body: { accID, postId, comment, parentId? }
      query: (body) => ({
        url: `/interactions/addComment/`,
        method: "POST",
        body: body,
        timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
      // Put the created comment straight into the cached comment list for this
      // post, so the modal (and the comment count on the card) update instantly
      // without refetching every comment.
      async onQueryStarted(body, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const created = data?.comment;
          if (!created) return;
          dispatch(
            api.util.updateQueryData("getComments", { post_id: body.postId }, (draft) => {
              if (!Array.isArray(draft)) return;
              if (!draft.some((c) => c.comment_id === created.comment_id)) {
                draft.push(created);
              }
            })
          );
        } catch {
          // The caller shows the error toast.
        }
      },
    }),
    editComment: builder.mutation({
      // { comment_id, post_id, comment }
      query: ({ comment_id, comment }) => ({
        url: `/interactions/comment/${comment_id}/`,
        method: "PATCH",
        body: { comment },
        timeout,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const updated = data?.comment;
          if (!updated) return;
          dispatch(
            api.util.updateQueryData("getComments", { post_id: arg.post_id }, (draft) => {
              const c = draft?.find((x) => x.comment_id === updated.comment_id);
              if (c) {
                c.comment = updated.comment;
                c.edited = true;
              }
            })
          );
        } catch {
          /* caller shows the error */
        }
      },
    }),
    deleteComment: builder.mutation({
      // { comment_id, post_id }
      query: ({ comment_id }) => ({
        url: `/interactions/comment/${comment_id}/`,
        method: "DELETE",
        timeout,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const gone = new Set(data?.deleted_ids ?? [arg.comment_id]);
          dispatch(
            api.util.updateQueryData("getComments", { post_id: arg.post_id }, (draft) =>
              draft.filter((c) => !gone.has(c.comment_id))
            )
          );
        } catch {
          /* caller shows the error */
        }
      },
    }),
  }),
});

export const { useAddCommentMutation, useEditCommentMutation, useDeleteCommentMutation } =
  receivedApi;
