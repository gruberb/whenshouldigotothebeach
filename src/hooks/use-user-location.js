import { useState } from "react";

// Location is requested only on an explicit tap, kept in sessionStorage for
// the session, and never written to the URL.
const KEY = "user-location";

function read() {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (typeof value?.lat === "number" && typeof value?.lng === "number") {
      return value;
    }
  } catch {
    // fall through
  }
  return null;
}

export function useUserLocation() {
  const [location, setLocation] = useState(read);
  const [status, setStatus] = useState(location ? "granted" : "idle");

  const request = () => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const value = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          ts: Date.now(),
        };
        sessionStorage.setItem(KEY, JSON.stringify(value));
        setLocation(value);
        setStatus("granted");
      },
      () => setStatus("denied"),
      { timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const clear = () => {
    sessionStorage.removeItem(KEY);
    setLocation(null);
    setStatus("idle");
  };

  return { location, status, request, clear };
}
