import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_HOST } from "../../../utils/constants";

const timeout = 60000;

const rawAuthQuery = fetchBaseQuery({
  baseUrl: `${API_HOST}/api/accounts/`,
  credentials: "include",
  timeout: timeout,
});

// The access cookie only lives 5 minutes. If /me (or another call) gets a
// 401, renew it with the refresh cookie once and retry, so reloading the
// page later doesn't look like being logged out.
const NO_RETRY = ["login/", "token/refresh/", "logout/", "register/"];
const authBaseQuery = async (args, api, extra) => {
  let result = await rawAuthQuery(args, api, extra);
  const url = typeof args === "string" ? args : args.url;
  if (result.error?.status === 401 && !NO_RETRY.includes(url)) {
    const refreshed = await rawAuthQuery({ url: "token/refresh/", method: "POST" }, api, extra);
    if (refreshed.data) result = await rawAuthQuery(args, api, extra);
  }
  return result;
};

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: authBaseQuery,
  endpoints: (builder) => ({
    login: builder.mutation({
      query: ({ ...body }) => ({
        url: "login/",
        method: "POST",
        body: body,
        credentials: "include",
        timeout: timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
    register: builder.mutation({
      // body: { username, email, password, birthday, accepted_terms,
      //         terms_version, marketing_opt_in }
      query: (body) => ({
        url: "register/",
        method: "POST",
        body,
        timeout: timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
    forgotPassword: builder.mutation({
      query: ({ ...body }) => ({
        url: "forgotPassword/",
        method: "POST",
        body: body,
        timeout: timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
    resetPassword: builder.mutation({
      query: ({ token, new_password }) => ({
        url: "resetPassword/",
        method: "POST",
        body: {
          token,
          new_password,
        },
        timeout: timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
    refresh: builder.mutation({
      query: ({ ...body }) => ({
        url: "token/refresh/",
        method: "POST",
        body: body,
        credentials: "include",
        timeout: timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
    logout: builder.mutation({
      query: ({ ...body }) => ({
        url: "logout/",
        method: "POST",
        body: body,
        timeout: timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
    getMe: builder.query({
      query: () => ({
        url: "me/",
        method: "GET",
        credentials: "include",
        timeout: timeout,
      }),
      transformResponse: (response) => response,
      transformErrorResponse: (response) => response,
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useLogoutMutation,
  useGetMeQuery,
} = authApi;
