import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { scoreColor } from "@/features/beaches/utils/score-display";

const TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
function savedView(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey);
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
function BeachMap({ beaches, stale, storageKey = "beach-map-view", userLocation = null }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fitObserverRef = useRef(null);

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
      // Permanent name labels collide hopelessly at province zoom; a CSS
      // class hides them until the view is close enough to read them apart.
      mapRef.current._applyLabelVisibility = () => {
        containerRef.current?.classList.toggle(
          "hide-beach-labels",
          mapRef.current.getZoom() < 9,
        );
      };
      mapRef.current.on("zoomend", () =>
        mapRef.current._applyLabelVisibility(),
      );
      mapRef.current.on("moveend", () => {
        const center = mapRef.current.getCenter();
        sessionStorage.setItem(
          mapRef.current._storageKey ?? storageKey,
          JSON.stringify({
            lat: center.lat,
            lng: center.lng,
            zoom: mapRef.current.getZoom(),
          }),
        );
      });
    }

    mapRef.current._storageKey = storageKey;
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
    if (userLocation) {
      const dot = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 6,
        color: "#161826",
        weight: 1.5,
        fillColor: "#f5f4ff",
        fillOpacity: 1,
      });
      dot.bindTooltip("You", { direction: "top", offset: [0, -6] });
      group.addLayer(dot);
    }
    group.addTo(mapRef.current);
    layerRef.current = group;

    // The container can measure zero when the fit runs: the lazy chunk mounts
    // a beat before layout, and hidden or background tabs resolve vh against a
    // zero-size viewport. Fitting a zero-size map lands on a world view that
    // never corrects itself. The observer fires once the box has real
    // dimensions (including on the hidden-to-visible transition), fits, and
    // unhooks.
    fitObserverRef.current?.disconnect();
    const observer = new ResizeObserver(() => {
      if (!containerRef.current || containerRef.current.clientHeight === 0) {
        return;
      }
      observer.disconnect();
      if (fitObserverRef.current === observer) fitObserverRef.current = null;
      if (!mapRef.current) return;
      mapRef.current.invalidateSize();
      const stored = savedView(storageKey);
      if (stored) {
        mapRef.current.setView([stored.lat, stored.lng], stored.zoom, {
          animate: false,
        });
      } else if (beaches.length > 0) {
        mapRef.current.fitBounds(group.getBounds().pad(0.25), { maxZoom: 10 });
      }
      mapRef.current._applyLabelVisibility();
    });
    fitObserverRef.current = observer;
    observer.observe(containerRef.current);
  }, [beaches, stale, navigate, storageKey, userLocation]);

  useEffect(
    () => () => {
      fitObserverRef.current?.disconnect();
      fitObserverRef.current = null;
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
      aria-label="Map of Nova Scotia beaches colored by conditions"
    />
  );
}

export default BeachMap;
