import { Link } from "react-router-dom";
import Footer from "@/components/footer";

// `header` swaps the compact linked-title nav for a page-owned header (the
// homepage's full-size title block); detail pages keep the default.
function Layout({ children, right, subtitle, header }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-[920px] mx-auto px-6 pt-7 w-full flex-1">
        {header ?? (
          <>
            <nav className="flex items-start justify-between gap-4 py-2">
              <div>
                <Link
                  to="/"
                  className="font-display font-medium text-2xl md:text-[28px] leading-tight text-noct-text no-underline block"
                >
                  When should I go to the beach?
                </Link>
                <div className="text-[11px] uppercase tracking-[0.1em] text-neutral-500 mt-1.5">
                  {subtitle ?? "Nova Scotia"}
                </div>
              </div>
              {right}
            </nav>
            <div className="rule mb-6" />
          </>
        )}
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}

export default Layout;
