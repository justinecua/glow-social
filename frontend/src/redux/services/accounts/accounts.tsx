import { api } from "../auth/token";

const timeout = 60000;

export const accounts = api.injectEndpoints({
  endpoints: (builder) => ({
    getNewUsers: builder.query({
      query: () => ({
        url: `accounts/getNewUsers`,
        method: "GET",
        timeout: timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
    getWsTicket: builder.mutation({
      // Short-lived signed ticket used to authenticate the WebSocket.
      // A mutation so a fresh ticket is fetched on every (re)connect.
      query: () => ({
        url: `accounts/wsTicket/`,
        method: "GET",
        timeout,
      }),
    }),
    exportMyData: builder.mutation({
      // A mutation (not a query) so the export is never cached.
      query: () => ({
        url: `accounts/exportMyData/`,
        method: "GET",
        timeout,
      }),
    }),
    deleteMyAccount: builder.mutation({
      query: ({ password }) => ({
        url: `accounts/deleteMyAccount/`,
        method: "POST",
        body: { password },
        timeout,
      }),
      transformErrorResponse: (response) => response,
    }),
    getProfile: builder.query({
      query: ({ profile_id }) => ({
        url: `accounts/profile/${profile_id}`,
        method: "GET",
        timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
    getTotalFriends: builder.query({
      query: ({ account_id }) => ({
        url: `/friends/getTotalFriends/${account_id}`,
        method: "GET",
        timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
  }),
});

export const {
  useGetNewUsersQuery,
  useGetProfileQuery,
  useGetTotalFriendsQuery,
  useExportMyDataMutation,
  useDeleteMyAccountMutation,
} = accounts;
