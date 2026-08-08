import React from "react";
import { STALE_META, VERDICT_META } from "../../lib/format";

function VerdictBadge({ verdict, stale }) {
  const meta = stale ? STALE_META : VERDICT_META[verdict];
  if (!meta) return null;
  return <span className={`tag ${meta.tag}`}>{meta.label}</span>;
}

export default VerdictBadge;
