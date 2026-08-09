import { STALE_META, VERDICT_META } from "@/features/beaches/utils/meta";

function VerdictBadge({ verdict, stale }) {
  const meta = stale ? STALE_META : VERDICT_META[verdict];
  if (!meta || meta.quiet) return null;
  return <span className={`tag ${meta.tag}`}>{meta.label}</span>;
}

export default VerdictBadge;
