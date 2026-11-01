import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_HOST } from "../../../utils/constants";

const baseQuery = fetchBaseQuery({
  baseUrl: `${API_HOST}/api/`,
  credentials: "include",
  prepareHeaders: (headers) => {
    headers.set("Content-Type", "application/json");
    return headers;
  },
});

const baseQueryWithRefreshToken = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result?.error?.status === 401) {
    const refreshResult = await baseQuery(
      {
        url: "accounts/token/refresh/",
        method: "POST",
      },
      api,
      extraOptions
    );

    if (refreshResult?.data) {
      result = await baseQuery(args, api, extraOptions);
    } else {
    }
  }

  return result;
};

export const api = createApi({
  baseQuery: baseQueryWithRefreshToken,
  endpoints: (builder) => ({}),
});
