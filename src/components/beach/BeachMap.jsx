import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { scoreColor } from "../../lib/format";

const TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const VIEW_KEY = "beach-map-view";

function savedView() {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lat !== "number" ||
      typeof parsed?.lng !== "number" ||
      typeof parsed?.zoom !== "number" ||
      parsed.zoom < 7 ||
      parsed.lat < 42.5 ||
      parsed.lat > 46 ||
      parsed.lng < -67 ||
      parsed.lng > -62
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Markers reuse the hour-strip language: brighter accent = better peak score.
// Names are permanent labels, a click goes straight to the beach page, and
// the last map position is kept for the session so Back lands where you were.
function BeachMap({ beaches, stale }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        scrollWheelZoom: false,
        // The fade never completes when the map mounts inside a lazy chunk,
        // leaving tiles stuck at low opacity over the container background.
        fadeAnimation: false,
      });
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 17 }).addTo(
        mapRef.current,
      );
      mapRef.current.on("moveend", () => {
        const center = mapRef.current.getCenter();
        sessionStorage.setItem(
          VIEW_KEY,
          JSON.stringify({
            lat: center.lat,
            lng: center.lng,
            zoom: mapRef.current.getZoom(),
          }),
        );
      });
    }

    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }
    const group = L.featureGroup();
    for (const beach of beaches) {
      const marker = L.circleMarker([beach.latitude, beach.longitude], {
        radius: 9,
        color: "#161826",
        weight: 1.5,
        fillColor: stale ? "#595d6c" : scoreColor(beach.peakScore),
        fillOpacity: 0.95,
      });
      marker.bindTooltip(beach.name, {
        permanent: true,
        direction: "auto",
        offset: [10, 0],
        interactive: true,
        className: "beach-label",
      });
      marker.on("click", () => navigate(`/beach/${beach.id}`));
      group.addLayer(marker);
    }
    group.addTo(mapRef.current);
    layerRef.current = group;

    // The container gets its height a frame after the lazy component mounts;
    // sizing the map before that leaves it fitted to a zero-height box.
    requestAnimationFrame(() => {
      if (!mapRef.current) return;
      mapRef.current.invalidateSize();
      const stored = savedView();
      if (stored) {
        mapRef.current.setView([stored.lat, stored.lng], stored.zoom, {
          animate: false,
        });
      } else if (beaches.length > 0) {
        mapRef.current.fitBounds(group.getBounds().pad(0.25), { maxZoom: 10 });
      }
    });
  }, [beaches, stale, navigate]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className="card h-[55vh] md:h-[62vh] w-full overflow-hidden"
      role="region"
      aria-label="Map of South Shore beaches colored by conditions"
    />
  );
}

export default BeachMap;
