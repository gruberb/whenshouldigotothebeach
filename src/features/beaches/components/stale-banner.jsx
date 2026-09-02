import { formatUpdatedAgo } from "@/utils/format";

// One notice per freshness tier, quietest first. In the mono palette the
// tag treatment carries the severity: neutral while the verdicts still
// stand, outline once they have been hidden.
function noticeFor({ expired, weatherStale }) {
  if (expired) {
    return {
      tag: "Data stale",
      tagClass: "tag-outline",
      text:
        "Verdicts are hidden because they can no longer be trusted. Check the official weather forecast and beach advisories before heading out.",
    };
  }
  if (weatherStale) {
    return {
      tag: "Update delayed",
      tagClass: "tag-neutral",
      text:
        "Verdicts still stand but rest on an older forecast. Check the official forecast and beach advisories before heading out.",
    };
  }
  return {
    tag: "Update delayed",
    tagClass: "tag-neutral",
    text:
      "Verdicts still stand, but swimming advisories have not been re-checked since. Confirm with Nova Scotia Parks before swimming.",
  };
}

function StaleBanner({ generatedAt, freshness, now }) {
  const { tag, tagClass, text } = noticeFor(freshness);
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className={`tag ${tagClass} shrink-0`}>{tag}</span>
      <p className="text-sm text-neutral-300 m-0">
        The last successful update was {formatUpdatedAgo(generatedAt, now)}.{" "}
        {text}
      </p>
    </div>
  );
}

export default StaleBanner;
