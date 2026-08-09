import { Link } from "react-router-dom";
import Layout from "@/components/layout";

function NotFound() {
  return (
    <Layout>
      <div className="py-10">
        <p className="text-[11px] uppercase tracking-[0.14em] text-accent mb-2.5 m-0">
          404
        </p>
        <h1 className="font-display font-medium text-4xl m-0 mb-2">
          Washed away
        </h1>
        <p className="text-sm text-neutral-500 mb-5">
          This page does not exist.
        </p>
        <Link to="/" className="btn btn-primary no-underline">
          All beaches
        </Link>
      </div>
    </Layout>
  );
}

export default NotFound;
