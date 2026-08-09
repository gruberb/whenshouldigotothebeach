// Sequential accent ramp: brighter = better on the dark ground. Single hue,
// so it survives every CVD type (value carries the signal, not hue).
export function scoreColor(score) {
  if (score >= 85) return "#b5abfc";
  if (score >= 72) return "#968ae0";
  if (score >= 55) return "#796cbf";
  if (score >= 40) return "#5d5294";
  return "#2b2741";
}

export const NIGHT_FILL = "#292b31";
