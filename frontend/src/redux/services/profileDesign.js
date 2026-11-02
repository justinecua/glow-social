import { api } from "./auth/token";

const timeout = 30000;

export const profileDesignApi = api.enhanceEndpoints({ addTagTypes: ["ProfileDesign", "MyDesign"] }).injectEndpoints({
  endpoints: (builder) => ({
    getProfileDesign: builder.query({
      query: (profileId) => ({ url: `accounts/profile/${profileId}/design/`, method: "GET", timeout }),
      providesTags: (r, e, profileId) => [{ type: "ProfileDesign", id: String(profileId) }],
    }),
    getMyDesign: builder.query({
      query: () => ({ url: "accounts/me/design/", method: "GET", timeout }),
      providesTags: ["MyDesign"],
    }),
    saveMyDesign: builder.mutation({
      query: ({ design, publish }) => ({ url: "accounts/me/design/", method: "PUT", body: { design, publish }, timeout }),
      invalidatesTags: (r, e, { profileId, publish }) =>
        publish ? ["MyDesign", { type: "ProfileDesign", id: String(profileId) }] : ["MyDesign"],
    }),
    previewDesignBlocks: builder.mutation({
      query: (blocks) => ({ url: "accounts/me/design/preview/", method: "POST", body: { blocks }, timeout }),
    }),
  }),
});

export const {
  useGetProfileDesignQuery,
  useGetMyDesignQuery,
  useSaveMyDesignMutation,
  usePreviewDesignBlocksMutation,
} = profileDesignApi;
