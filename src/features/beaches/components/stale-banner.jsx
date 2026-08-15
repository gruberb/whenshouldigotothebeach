import { formatUpdatedAgo } from "@/utils/format";

function StaleBanner({ generatedAt }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="tag tag-outline shrink-0">Data stale</span>
      <p className="text-sm text-neutral-300 m-0">
        The last successful update was {formatUpdatedAgo(generatedAt)}.
        Verdicts are hidden because they can no longer be trusted. Check the
        official weather forecast and beach advisories before heading out.
      </p>
    </div>
  );
}

export default StaleBanner;
