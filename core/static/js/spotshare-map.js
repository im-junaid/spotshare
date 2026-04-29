/**
 * SpotShare — Universal Map Module
 *
 * Shared Leaflet map factory used by both host (spot picker) and driver (spot finder).
 * Handles theme-aware tiles, custom markers, geolocation, and Nominatim search.
 *
 * Usage:
 *   const map = SpotMap.create("map-element-id", { center: [lat, lng], zoom: 13 });
 *   SpotMap.geolocate(map, { onSuccess(lat, lng) {} });
 */
window.SpotMap = (function () {
  "use strict";

  // Tile URLs
  const TILES = {
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    voyager:
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  };

  const ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

  // Default center (Karachi)
  const DEFAULT_CENTER = [9.9312, 76.2673]; // Kochi, Kerala
  const DEFAULT_ZOOM = 13;

  /**
   * Create a themed Leaflet map.
   * @param {string} elementId  DOM id of the map container
   * @param {Object} opts
   * @param {number[]} opts.center  [lat, lng]
   * @param {number}   opts.zoom
   * @param {boolean}  opts.zoomControl
   * @param {string}   opts.style  "auto" | "dark" | "voyager"
   * @returns {L.Map}
   */
  function create(elementId, opts = {}) {
    const center = opts.center || DEFAULT_CENTER;
    const zoom = opts.zoom || DEFAULT_ZOOM;
    const style = opts.style || "auto";

    const map = L.map(elementId, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    }).setView(center, zoom);

    // Attach tile layers
    const darkLayer = L.tileLayer(TILES.dark, {
      attribution: ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 19,
    });

    const voyagerDark = L.tileLayer(TILES.voyager, {
      attribution: ATTRIBUTION,
      maxZoom: 19,
      className: "map-tiles-dark",
    });

    const voyagerLight = L.tileLayer(TILES.voyager, {
      attribution: ATTRIBUTION,
      maxZoom: 19,
    });

    // Store layers on map instance for theme switching
    map._spot = {
      darkLayer,
      voyagerDark,
      voyagerLight,
      style,
    };

    applyTheme(map);

    // Watch for theme changes
    const observer = new MutationObserver(() => applyTheme(map));
    observer.observe(document.documentElement, { attributes: true });
    map._spot.themeObserver = observer;

    // Zoom control top-right
    L.control
      .zoom({ position: opts.zoomPosition || "topright" })
      .addTo(map);

    return map;
  }

  function applyTheme(map) {
    const isLight = document.documentElement.classList.contains("light");
    const s = map._spot;

    // Remove all tile layers first
    [s.darkLayer, s.voyagerDark, s.voyagerLight].forEach((layer) => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });

    if (s.style === "dark") {
      // Always dark tiles (driver search)
      s.darkLayer.addTo(map);
    } else if (s.style === "voyager") {
      // Theme-reactive voyager tiles (host spot picker)
      (isLight ? s.voyagerLight : s.voyagerDark).addTo(map);
    } else {
      // "auto" — dark page uses dark tiles, light uses voyager
      if (isLight) {
        s.voyagerLight.addTo(map);
      } else {
        s.darkLayer.addTo(map);
      }
    }
  }

  /**
   * Create the branded pin icon (pulsing dot).
   */
  function pinIcon(opts = {}) {
    return L.divIcon({
      className: opts.className || "map-pin-dot-icon",
      html: '<div class="map-pin-dot"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  /**
   * Create a small spot marker icon.
   */
  function spotIcon(opts = {}) {
    return L.divIcon({
      className: opts.className || "custom-marker",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  /**
   * Create user location marker icon.
   */
  function userIcon() {
    return L.divIcon({
      className: "user-marker",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  /**
   * Geolocate the user.
   * @param {Object} callbacks
   * @param {Function} callbacks.onSuccess(lat, lng)
   * @param {Function} callbacks.onError(msg)
   * @param {Object}   callbacks.options  geolocation options
   */
  function geolocate(callbacks = {}) {
    if (!navigator.geolocation) {
      if (callbacks.onError) callbacks.onError("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (callbacks.onSuccess) {
          callbacks.onSuccess(pos.coords.latitude, pos.coords.longitude);
        }
      },
      (err) => {
        const msgs = {
          1: "Location access denied",
          2: "Position unavailable",
          3: "Location timed out",
        };
        if (callbacks.onError) {
          callbacks.onError(msgs[err.code] || "Location unavailable");
        }
      },
      callbacks.options || {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  /**
   * Reverse geocode lat/lng to address using Nominatim.
   * @returns {Promise<string|null>}
   */
  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      const data = await res.json();
      return data?.display_name || null;
    } catch {
      return null;
    }
  }

  /**
   * Search for places using Nominatim.
   * @returns {Promise<Array>}
   */
  async function searchPlaces(query, limit = 5) {
    if (!query || query.length < 3) return [];
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}`,
      );
      return await res.json();
    } catch {
      return [];
    }
  }

  /**
   * Utility: debounce a function.
   */
  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  return {
    create,
    pinIcon,
    spotIcon,
    userIcon,
    geolocate,
    reverseGeocode,
    searchPlaces,
    debounce,
  };
})();
