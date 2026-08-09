import { BrowserRouter, Route, Routes } from "react-router-dom";
import ScrollToTop from "@/components/scroll-to-top";
import BeachDetail from "@/app/routes/beach-detail";
import Home from "@/app/routes/home";
import NotFound from "@/app/routes/not-found";

// Pages deploy as a static SPA: the build copies index.html to 404.html so
// deep links land here rather than on a Pages 404.
export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/beach/:beachId" element={<BeachDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
