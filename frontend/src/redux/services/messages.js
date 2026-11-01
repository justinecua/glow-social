import { api } from "./auth/token";

const timeout = 60000;

export const messagesApi = api
  .enhanceEndpoints({ addTagTypes: ["Inbox", "Conversation", "Unread"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getConversations: builder.query({
        query: () => ({ url: "messages/conversations/", timeout }),
        providesTags: ["Inbox"],
      }),
      getConversation: builder.query({
        query: (id) => ({ url: `messages/conversations/${id}/`, timeout }),
        providesTags: (_r, _e, id) => [{ type: "Conversation", id }],
      }),
      getMessages: builder.query({
        query: (id) => ({ url: `messages/conversations/${id}/messages/`, timeout }),
        keepUnusedDataFor: 300,
      }),
      // Older page, loaded when scrolling up (not cached with the live page).
      getOlderMessages: builder.query({
        query: ({ conversation_id, before }) => ({
          url: `messages/conversations/${conversation_id}/messages/?before=${before}`,
          timeout,
        }),
        keepUnusedDataFor: 0,
      }),
      getUnreadMessages: builder.query({
        query: () => ({ url: "messages/unread/", timeout }),
        providesTags: ["Unread"],
      }),
      startConversation: builder.mutation({
        query: (body) => ({ url: "messages/conversations/", method: "POST", body, timeout }),
        invalidatesTags: ["Inbox"],
      }),
      sendMessage: builder.mutation({
        query: ({ conversation_id, body }) => ({
          url: `messages/conversations/${conversation_id}/messages/`,
          method: "POST",
          body: { body },
          timeout,
        }),
      }),
      markRead: builder.mutation({
        query: (id) => ({ url: `messages/conversations/${id}/read/`, method: "POST", timeout }),
        invalidatesTags: ["Unread"],
      }),
      editMessage: builder.mutation({
        query: ({ message_id, body }) => ({
          url: `messages/messages/${message_id}/`,
          method: "PATCH",
          body: { body },
          timeout,
        }),
      }),
      deleteMessage: builder.mutation({
        query: (message_id) => ({
          url: `messages/messages/${message_id}/`,
          method: "DELETE",
          timeout,
        }),
      }),
      renameGroup: builder.mutation({
        query: ({ conversation_id, title }) => ({
          url: `messages/conversations/${conversation_id}/`,
          method: "PATCH",
          body: { title },
          timeout,
        }),
        invalidatesTags: (_r, _e, { conversation_id }) => [
          "Inbox",
          { type: "Conversation", id: conversation_id },
        ],
      }),
      addMembers: builder.mutation({
        query: ({ conversation_id, member_ids }) => ({
          url: `messages/conversations/${conversation_id}/members/`,
          method: "POST",
          body: { member_ids },
          timeout,
        }),
        invalidatesTags: (_r, _e, { conversation_id }) => [
          "Inbox",
          { type: "Conversation", id: conversation_id },
        ],
      }),
      leaveConversation: builder.mutation({
        query: (id) => ({
          url: `messages/conversations/${id}/members/`,
          method: "DELETE",
          timeout,
        }),
        invalidatesTags: ["Inbox", "Unread"],
      }),
    }),
  });

export const {
  useGetConversationsQuery,
  useGetConversationQuery,
  useGetMessagesQuery,
  useGetUnreadMessagesQuery,
  useLazyGetOlderMessagesQuery,
  useStartConversationMutation,
  useSendMessageMutation,
  useMarkReadMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useRenameGroupMutation,
  useAddMembersMutation,
  useLeaveConversationMutation,
} = messagesApi;
