
// Minimal stroke icons in the Feather idiom, one per reason kind. Sized for
// inline chips; color comes from the parent via currentColor.
const PATHS = {
  thunder: <path d="M8.5 1.5 3.5 8.5h3L5.5 14.5 12.5 7h-3l1-5.5z" />,
  rain: (
    <>
      <path d="M4.5 9a3 3 0 1 1 .6-5.9 4 4 0 0 1 7.8 1.1A2.5 2.5 0 0 1 12 9z" />
      <path d="M5.5 11.5v2M8.5 11.5v2M11.5 11.5v2" />
    </>
  ),
  dry: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" />
    </>
  ),
  fog: <path d="M2 6h12M3.5 9h9M5 12h6" />,
  wind: <path d="M2 5.5h7a2 2 0 1 0-2-2M2 8.5h10a2 2 0 1 1-2 2M2 11.5h5" />,
  offshore: <path d="M2 5.5h7a2 2 0 1 0-2-2M2 8.5h10a2 2 0 1 1-2 2M2 11.5h5" />,
  temperature: (
    <>
      <path d="M6.5 2.5a1.5 1.5 0 0 1 3 0V9a3 3 0 1 1-3 0z" />
      <circle cx="8" cy="11.5" r="1" />
    </>
  ),
  heat: (
    <>
      <path d="M6.5 2.5a1.5 1.5 0 0 1 3 0V9a3 3 0 1 1-3 0z" />
      <path d="M12.5 3v3M12.5 8.5h.01" />
    </>
  ),
  tide: <path d="M1.5 7c1.6 0 1.6-1.5 3.2-1.5S6.3 7 7.9 7s1.6-1.5 3.2-1.5S12.7 7 14.5 7M1.5 11c1.6 0 1.6-1.5 3.2-1.5S6.3 11 7.9 11s1.6-1.5 3.2-1.5 1.6 1.5 3.4 1.5" />,
  none: <circle cx="8" cy="8" r="5" />,
};

function ReasonIcon({ kind }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {PATHS[kind] ?? PATHS.none}
    </svg>
  );
}

export default ReasonIcon;
