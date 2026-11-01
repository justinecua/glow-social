import { api } from "../auth/token";

const timeout = 60000;

export const receivedApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNotificationsByUser: builder.query({
      query: ({ account_id }) => ({
        url: `/notifications/showNotificationsByUser/${account_id}`,
        method: "GET",
        withCredentials: true,
        timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
    getCountNotificationsByUser: builder.query({
      query: ({ account_id }) => ({
        url: `/notifications/countNotifications/${account_id}`,
        method: "GET",
        withCredentials: true,
        timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
  }),
});

export const {
  useGetNotificationsByUserQuery,
  useGetCountNotificationsByUserQuery,
} = receivedApi;
