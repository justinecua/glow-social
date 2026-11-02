import { useState } from "react";
import { useGetLinkPreviewQuery } from "@/redux/services/posts/posts";

export const useCourtPreview = (url) => {
  const { data, isLoading } = useGetLinkPreviewQuery(url, { skip: !url });
  const [failed, setFailed] = useState(false);
  return {
    loading: !!url && isLoading,
    image: !failed && data?.image ? data.image : null,
    title: data?.title || "",
    onError: () => setFailed(true),
  };
};
