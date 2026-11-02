import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== "POP") window.scrollTo({ top: 0, behavior: "auto" }); // Back/Forward keeps the browser's saved position
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;
