import { api } from "../auth/token";

const timeout = 60000;

export const receivedApi = api
  .enhanceEndpoints({ addTagTypes: ["Notifications"] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getNotificationsByUser: builder.query({
        query: ({ account_id }) => ({
          url: `/notifications/showNotificationsByUser/${account_id}/`,
          method: "GET",
          timeout,
        }),
        providesTags: ["Notifications"],
      }),
      getCountNotificationsByUser: builder.query({
        // Unread notifications only
        query: ({ account_id }) => ({
          url: `/notifications/countNotifications/${account_id}/`,
          method: "GET",
          timeout,
        }),
        providesTags: ["Notifications"],
      }),
      markAllNotificationsRead: builder.mutation({
        query: () => ({ url: `/notifications/markAllRead/`, method: "POST", timeout }),
        invalidatesTags: ["Notifications"],
      }),
    }),
  });

export const {
  useGetNotificationsByUserQuery,
  useGetCountNotificationsByUserQuery,
  useMarkAllNotificationsReadMutation,
} = receivedApi;
