import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Data loads async, so the browser's native scroll restoration fires while
// the page is still short and clamps to the top. Restoration is handled
// manually instead: pages that care (Home) restore from sessionStorage once
// their content is in; forward navigation always starts at the top.
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo(0, 0);
    }
  }, [pathname, navigationType]);

  return null;
}

export default ScrollToTop;
