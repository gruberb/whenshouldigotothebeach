import { useState } from "react";

const KEY = "favourite-beaches";

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function useFavourites() {
  const [ids, setIds] = useState(read);

  const toggle = (id) =>
    setIds((previous) => {
      const next = previous.includes(id)
        ? previous.filter((entry) => entry !== id)
        : [...previous, id];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });

  return { favourites: new Set(ids), toggle };
}
