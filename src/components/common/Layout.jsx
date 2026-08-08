import React from "react";
import { Link } from "react-router-dom";
import Footer from "./Footer";

function Layout({ children, right }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-[920px] mx-auto px-6 pt-7 w-full flex-1">
        <nav className="flex items-center gap-4 py-2">
          <Link
            to="/"
            className="font-display font-medium text-lg text-noct-text no-underline mr-auto"
          >
            When should I go to the beach?
          </Link>
          {right ?? (
            <span className="text-xs uppercase tracking-[0.08em] text-neutral-500">
              South Shore · Nova Scotia
            </span>
          )}
        </nav>
        <div className="rule mb-9" />
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}

export default Layout;
