import { api } from "../auth/token";

const timeout = 60000;

export const receivedApi = api.injectEndpoints({
  endpoints: (builder) => ({
    checkUserFriendRequest: builder.query({
      query: ({ friend_id, accId }) => ({
        url: `/friends/checkUserFriendRequest/${friend_id}/${accId}/`,
        method: "GET",
        timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
  }),
});

export const { useCheckUserFriendRequestQuery } = receivedApi;
