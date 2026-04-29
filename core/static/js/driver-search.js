/**
 * SpotShare — Driver Search Module
 * Handles geolocation, Leaflet map, spot fetching, filtering, and card rendering.
 */
(function () {
  "use strict";

  const state = {
    lat: null,
    lng: null,
    radius: 5,
    map: null,
    markers: [],
    userMarker: null,
    spots: [],
    activeFilters: new Set(),
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    searchInput: $("#search-input"),
    vehicleFilter: $("#vehicle-filter"),
    searchBtn: $("#search-btn"),
    radiusSlider: $("#radius-slider"),
    radiusValue: $("#radius-value"),
    spotsGrid: $("#spots-grid"),
    emptyState: $("#empty-state"),
    resultsCount: $("#results-count"),
    locationText: $("#location-text"),
    recenterBtn: $("#recenter-btn"),
    cardTpl: $("#spot-card-tpl"),
  };

  const FALLBACK_IMG =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%23141414'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23333' font-size='14' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";

  // Init
  function init() {
    initMap();
    getLocation();
    bindEvents();
  }

  // Map
  function initMap() {
    state.map = SpotMap.create("spot-map", {
      style: "auto",
    });
  }

  // Geolocation
  function getLocation() {
    setLocationStatus("Detecting location…", true);
    SpotMap.geolocate({
      onSuccess: (lat, lng) => {
        state.lat = lat;
        state.lng = lng;
        setLocationStatus("Location detected", true);
        centerMapOnUser();
        fetchSpots();
      },
      onError: (msg) => {
        setLocationStatus(msg, false);
        fetchSpots();
      },
    });
  }

  function setLocationStatus(text, ok) {
    els.locationText.textContent = text;
    const dot = els.locationText.parentElement.querySelector(".pulse-dot");
    if (dot)
      dot.style.background = ok
        ? "rgb(var(--brand-primary))"
        : "rgb(var(--danger))";
  }

  function centerMapOnUser() {
    if (!state.lat || !state.lng) return;
    state.map.setView([state.lat, state.lng], 14, { animate: true });

    if (state.userMarker) state.map.removeLayer(state.userMarker);
    state.userMarker = L.marker([state.lat, state.lng], {
      icon: SpotMap.userIcon(),
      zIndexOffset: 1000,
    })
      .addTo(state.map)
      .bindPopup(
        '<div class="text-center p-1"><div class="font-semibold text-sm" style="color:rgb(var(--brand-primary))">📍 You are here</div></div>',
      );
  }

  //   Fetch
  function fetchSpots() {
    const params = new URLSearchParams();
    if (state.lat) params.set("lat", state.lat);
    if (state.lng) params.set("lng", state.lng);
    params.set("radius", state.radius);

    const q = els.searchInput.value.trim();
    if (q) params.set("q", q);
    const v = els.vehicleFilter.value;
    if (v) params.set("vehicle_size", v);
    state.activeFilters.forEach((f) => params.set(f, "1"));
    
    const startEl = document.getElementById("filter-start");
    const endEl = document.getElementById("filter-end");
    if (startEl && startEl.value) params.set("start_time", startEl.value);
    if (endEl && endEl.value) params.set("end_time", endEl.value);

    fetch("/driver/api/spots/?" + params)
      .then((r) => r.json())
      .then((data) => {
        state.spots = data.spots || [];
        renderSpots();
        renderMapMarkers();
      })
      .catch(() => renderSpots());
  }

  // Render cards using <template>
  function renderSpots() {
    const spots = state.spots;
    els.resultsCount.textContent = spots.length + " Spots Available";

    if (!spots.length) {
      els.spotsGrid.innerHTML = "";
      els.emptyState.classList.remove("hidden");
      return;
    }
    els.emptyState.classList.add("hidden");
    els.spotsGrid.innerHTML = "";

    spots.forEach((spot, i) => {
      const card = els.cardTpl.content.cloneNode(true);
      const root = card.querySelector(".spot-card");

      // Data attributes
      root.dataset.id = spot.id;
      root.dataset.lat = spot.lat;
      root.dataset.lng = spot.lng;

      // Image
      const img = card.querySelector('[data-field="image"]');
      img.src = spot.image || FALLBACK_IMG;
      img.alt = spot.title;

      // Text fields
      card.querySelector('[data-field="title"]').textContent = spot.title;
      card.querySelector('[data-field="rate"]').textContent = "₹" + spot.rate;

      // Distance
      if (spot.distance_km !== null) {
        const distRow = card.querySelector('[data-field="distance-row"]');
        distRow.classList.remove("hidden");
        card.querySelector('[data-field="distance"]').textContent =
          spot.distance_km + " km";
      }

      // Amenities
      const amenitiesEl = card.querySelector('[data-field="amenities"]');
      const tags = [];
      if (spot.is_covered) tags.push("Covered");
      if (spot.has_cctv) tags.push("CCTV");
      if (spot.has_guard) tags.push("Guard");
      if (spot.has_ev_charging) tags.push("EV");
      if (spot.vehicle_size_display) tags.push(spot.vehicle_size_display);
      tags.forEach((t) => {
        const badge = document.createElement("span");
        badge.className = "badge-amenity";
        badge.textContent = t;
        amenitiesEl.appendChild(badge);
      });

      // Book button — link to spot detail
      const bookBtn = card.querySelector('[data-field="book-btn"]');
      bookBtn.href = "/driver/spot/" + spot.id + "/";
      bookBtn.addEventListener("click", (e) => e.stopPropagation());

      // Staggered entrance animation
      root.style.opacity = "0";
      root.style.transform = "translateY(12px)";

      els.spotsGrid.appendChild(card);

      setTimeout(() => {
        root.style.transition = "opacity 0.35s ease, transform 0.35s ease";
        root.style.opacity = "1";
        root.style.transform = "translateY(0)";
      }, i * 70);
    });

    // Card click → fly to map marker
    els.spotsGrid.querySelectorAll(".spot-card").forEach((card) => {
      card.addEventListener("click", () => {
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        if (!lat || !lng) return;
        state.map.flyTo([lat, lng], 16, { duration: 0.8 });
        const m = state.markers.find(
          (m) => m.spotId === parseInt(card.dataset.id),
        );
        if (m) m.marker.openPopup();
      });
    });
  }

  // Map markers
  function renderMapMarkers() {
    state.markers.forEach((m) => state.map.removeLayer(m.marker));
    state.markers = [];

    const icon = SpotMap.spotIcon();

    state.spots.forEach((spot) => {
      const marker = L.marker([spot.lat, spot.lng], { icon })
        .addTo(state.map)
        .bindPopup(
          '<div class="p-1" style="min-width:180px">' +
            '<div class="font-semibold text-sm mb-1">' +
            spot.title +
            "</div>" +
            '<div class="text-xs opacity-70 mb-2">' +
            spot.address +
            "</div>" +
            '<div class="flex justify-between items-center">' +
            '<span style="color:rgb(var(--brand-primary))" class="font-bold text-sm">₹' +
            spot.rate +
            "/hr</span>" +
            (spot.distance_km !== null
              ? '<span class="text-xs opacity-60">' +
                spot.distance_km +
                " km</span>"
              : "") +
            "</div></div>",
        );
      state.markers.push({ spotId: spot.id, marker });
    });

    if (state.spots.length > 0 && !state.lat) {
      const group = L.featureGroup(state.markers.map((m) => m.marker));
      state.map.fitBounds(group.getBounds().pad(0.2));
    }
  }

  // Events
  function bindEvents() {
    els.searchBtn.addEventListener("click", fetchSpots);
    els.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fetchSpots();
    });
    els.vehicleFilter.addEventListener("change", fetchSpots);
    
    const startEl = document.getElementById("filter-start");
    const endEl = document.getElementById("filter-end");
    if (startEl) startEl.addEventListener("change", fetchSpots);
    if (endEl) endEl.addEventListener("change", fetchSpots);

    $$(".chip[data-filter]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const f = chip.dataset.filter;
        state.activeFilters.has(f)
          ? state.activeFilters.delete(f)
          : state.activeFilters.add(f);
        chip.classList.toggle("active");
        fetchSpots();
      });
    });

    els.radiusSlider.addEventListener("input", (e) => {
      state.radius = parseInt(e.target.value);
      els.radiusValue.textContent = state.radius + " km";
    });
    els.radiusSlider.addEventListener("change", fetchSpots);

    els.recenterBtn.addEventListener("click", () => {
      state.lat && state.lng ? centerMapOnUser() : getLocation();
    });
  }

  // Loading
  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
