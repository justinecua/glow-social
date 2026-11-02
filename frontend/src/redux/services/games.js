import { api } from "./auth/token";

const timeout = 30000;

export const gamesApi = api.enhanceEndpoints({ addTagTypes: ["Game"] }).injectEndpoints({
  endpoints: (builder) => ({
    getGame: builder.query({
      query: (id) => ({ url: `games/${id}/`, method: "GET", timeout }),
      providesTags: (r, e, id) => [{ type: "Game", id }],
    }),
    updateGame: builder.mutation({
      query: ({ id, ...body }) => ({ url: `games/${id}/`, method: "PATCH", body, timeout }),
      invalidatesTags: (r, e, { id }) => [{ type: "Game", id }],
    }),
    joinGame: builder.mutation({
      query: (id) => ({ url: `games/${id}/join/`, method: "POST", timeout }),
      invalidatesTags: (r, e, id) => [{ type: "Game", id }],
    }),
    leaveGame: builder.mutation({
      query: (id) => ({ url: `games/${id}/join/`, method: "DELETE", timeout }),
      invalidatesTags: (r, e, id) => [{ type: "Game", id }],
    }),
  }),
});

export const { useGetGameQuery, useUpdateGameMutation, useJoinGameMutation, useLeaveGameMutation } = gamesApi;
