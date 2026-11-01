import { api } from "./auth/token";

const timeout = 60000;

export type ChatPerson = {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile_photo: string;
};

export type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  is_deleted: boolean;
  edited: boolean;
  created_at: string;
  pending?: boolean;
};

export type Conversation = {
  id: number;
  is_group: boolean;
  title: string;
  name: string;
  members: ChatPerson[];
  member_reads: Record<string, string | null>;
  created_by: number | null;
  updated_at: string;
  unread: number;
  last_message: ChatMessage | null;
  my_last_read_at: string | null;
};

export const messagesApi = api
  .enhanceEndpoints({ addTagTypes: ["Inbox", "Conversation", "Unread"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getConversations: builder.query<Conversation[], void>({
        query: () => ({ url: "messages/conversations/", timeout }),
        providesTags: ["Inbox"],
      }),
      getConversation: builder.query<Conversation, number>({
        query: (id) => ({ url: `messages/conversations/${id}/`, timeout }),
        providesTags: (_r, _e, id) => [{ type: "Conversation", id }],
      }),
      getMessages: builder.query<{ results: ChatMessage[]; has_more: boolean }, number>({
        query: (id) => ({ url: `messages/conversations/${id}/messages/`, timeout }),
        keepUnusedDataFor: 300,
      }),
      // Older page, loaded when scrolling up (not cached with the live page).
      getOlderMessages: builder.query<
        { results: ChatMessage[]; has_more: boolean },
        { conversation_id: number; before: number }
      >({
        query: ({ conversation_id, before }) => ({
          url: `messages/conversations/${conversation_id}/messages/?before=${before}`,
          timeout,
        }),
        keepUnusedDataFor: 0,
      }),
      getUnreadMessages: builder.query<{ unread: number }, void>({
        query: () => ({ url: "messages/unread/", timeout }),
        providesTags: ["Unread"],
      }),
      startConversation: builder.mutation<Conversation, { member_ids: number[]; title?: string }>({
        query: (body) => ({ url: "messages/conversations/", method: "POST", body, timeout }),
        invalidatesTags: ["Inbox"],
      }),
      sendMessage: builder.mutation<ChatMessage, { conversation_id: number; body: string }>({
        query: ({ conversation_id, body }) => ({
          url: `messages/conversations/${conversation_id}/messages/`,
          method: "POST",
          body: { body },
          timeout,
        }),
      }),
      markRead: builder.mutation<{ read_at: string }, number>({
        query: (id) => ({ url: `messages/conversations/${id}/read/`, method: "POST", timeout }),
        invalidatesTags: ["Unread"],
      }),
      editMessage: builder.mutation<ChatMessage, { message_id: number; body: string }>({
        query: ({ message_id, body }) => ({
          url: `messages/messages/${message_id}/`,
          method: "PATCH",
          body: { body },
          timeout,
        }),
      }),
      deleteMessage: builder.mutation<ChatMessage, number>({
        query: (message_id) => ({ url: `messages/messages/${message_id}/`, method: "DELETE", timeout }),
      }),
      renameGroup: builder.mutation<Conversation, { conversation_id: number; title: string }>({
        query: ({ conversation_id, title }) => ({
          url: `messages/conversations/${conversation_id}/`,
          method: "PATCH",
          body: { title },
          timeout,
        }),
        invalidatesTags: (_r, _e, { conversation_id }) => ["Inbox", { type: "Conversation", id: conversation_id }],
      }),
      addMembers: builder.mutation<Conversation, { conversation_id: number; member_ids: number[] }>({
        query: ({ conversation_id, member_ids }) => ({
          url: `messages/conversations/${conversation_id}/members/`,
          method: "POST",
          body: { member_ids },
          timeout,
        }),
        invalidatesTags: (_r, _e, { conversation_id }) => ["Inbox", { type: "Conversation", id: conversation_id }],
      }),
      leaveConversation: builder.mutation<{ left: boolean }, number>({
        query: (id) => ({ url: `messages/conversations/${id}/members/`, method: "DELETE", timeout }),
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
