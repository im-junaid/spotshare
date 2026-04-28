document.addEventListener("DOMContentLoaded", () => {
  // WIZARD NAVIGATION
  const steps = document.querySelectorAll(".wizard-step");
  const indicators = document.querySelectorAll(".step-indicator");
  const progressFill = document.getElementById("progress-fill");
  let currentStep = 0;

  function goToStep(target) {
    if (target === currentStep) return;

    const currentEl = steps[currentStep];
    const targetEl = steps[target];

    // Validate before moving forward
    if (target > currentStep && !validateStep(currentStep)) return;

    // Exit animation
    currentEl.classList.add("exit-left");
    currentEl.classList.remove("visible");

    setTimeout(() => {
      currentEl.classList.remove("active", "exit-left");

      // Enter animation
      targetEl.classList.add("active");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          targetEl.classList.add("visible");
        });
      });

      currentStep = target;
      updateProgress();

      // Invalidate map size when switching to step 0
      if (target === 0 && window._spotMap) {
        setTimeout(() => window._spotMap.invalidateSize(), 100);
      }
    }, 250);
  }

  function updateProgress() {
    const pct = currentStep === 0 ? 0 : currentStep === 1 ? 50 : 100;
    progressFill.style.width = pct + "%";

    indicators.forEach((ind, i) => {
      const dot = ind.querySelector(".step-dot");
      const label = ind.querySelector(".step-label");
      if (i <= currentStep) {
        dot.className =
          "step-dot w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--brand-primary),0.35)]";
        label.className =
          "step-label text-[10px] font-bold uppercase tracking-[0.2em] text-primary transition-colors duration-300";
      } else {
        dot.className =
          "step-dot w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 bg-card text-muted-foreground border border-border";
        label.className =
          "step-label text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-300";
      }
    });
  }

  function validateStep(step) {
    if (step === 0) {
      const lat = document.getElementById("id_latitude").value;
      const lng = document.getElementById("id_longitude").value;
      const addr = document.getElementById("id_address").value.trim();
      if (!lat || !lng) {
        alert("Please click on the map to set your parking spot location.");
        return false;
      }
      if (!addr) {
        alert("Please enter the street address.");
        document.getElementById("id_address").focus();
        return false;
      }
    }
    if (step === 1) {
      const title = document.getElementById("id_title").value.trim();
      if (!title) {
        alert("Please enter a title for your spot.");
        document.getElementById("id_title").focus();
        return false;
      }
    }
    return true;
  }

  // Next / Back buttons
  document.querySelectorAll(".next-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(parseInt(btn.dataset.next)));
  });
  document.querySelectorAll(".prev-step-btn").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(parseInt(btn.dataset.prev)));
  });

  // Clicking step indicators
  indicators.forEach((ind) => {
    ind.addEventListener("click", () => {
      const target = parseInt(ind.dataset.step);
      // Only allow going back freely, forward requires validation
      if (target < currentStep) goToStep(target);
      else if (target > currentStep) goToStep(target);
    });
  });

  // LEAFLET MAP
  const latInput = document.getElementById("id_latitude");
  const lngInput = document.getElementById("id_longitude");
  const coordsDisplay = document.getElementById("coords-display");
  const locateBtn = document.getElementById("locate-btn");
  const searchInput = document.getElementById("map-search");
  const resultsBox = document.getElementById("search-results");

  let initLat = latInput.value ? parseFloat(latInput.value) : 20.5937;
  let initLng = lngInput.value ? parseFloat(lngInput.value) : 78.9629;
  let initZoom = latInput.value ? 17 : 5;

  const map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
  }).setView([initLat, initLng], initZoom);
  window._spotMap = map;

  // TILE LAYERS
  const darkTiles = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    },
  );

  const lightTiles = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    },
  );

  function updateMapTheme() {
    const isLight = document.documentElement.classList.contains("light");
    if (isLight) {
      if (map.hasLayer(darkTiles)) map.removeLayer(darkTiles);
      lightTiles.addTo(map);
    } else {
      if (map.hasLayer(lightTiles)) map.removeLayer(lightTiles);
      darkTiles.addTo(map);
    }
  }

  updateMapTheme();

  const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "class") updateMapTheme();
    });
  });
  themeObserver.observe(document.documentElement, { attributes: true });

  // SEARCH LOGIC
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const performSearch = debounce(async (query) => {
    if (!query || query.length < 3) {
      resultsBox.classList.add("hidden");
      return;
    }
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
      );
      const data = await response.json();
      if (data && data.length > 0) {
        resultsBox.innerHTML = "";
        data.forEach((item) => {
          const div = document.createElement("div");
          div.className =
            "px-4 py-3 hover:bg-primary/10 cursor-pointer border-b border-border last:border-0 transition-colors text-foreground text-sm";
          div.innerHTML = `
            <p class="font-medium truncate">${item.display_name}</p>
            <p class="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">${item.type.replace("_", " ")}</p>
          `;
          div.addEventListener("click", () => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            map.setView([lat, lon], 17);
            setMarker(lat, lon);
            searchInput.value = item.display_name;
            resultsBox.classList.add("hidden");
          });
          resultsBox.appendChild(div);
        });
        resultsBox.classList.remove("hidden");
      } else {
        resultsBox.classList.add("hidden");
      }
    } catch (err) {
      console.error("Search error:", err);
    }
  }, 400);

  if (searchInput) {
    searchInput.addEventListener("input", (e) => performSearch(e.target.value));
    document.addEventListener("click", (e) => {
      if (!searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
        resultsBox.classList.add("hidden");
      }
    });
  }

  let marker = null;
  const pinIcon = L.divIcon({
    className: "custom-map-pin",
    html: '<div class="map-pin-dot"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  function setMarker(lat, lng) {
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = L.marker([lat, lng], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        updateCoords(pos.lat, pos.lng);
      });
    }
    updateCoords(lat, lng);
  }

  function updateCoords(lat, lng) {
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    coordsDisplay.textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    coordsDisplay.classList.remove("text-muted-foreground");
    coordsDisplay.classList.add("text-primary");
  }

  // Pick location by clicking
  map.on("click", (e) => setMarker(e.latlng.lat, e.latlng.lng));

  // Existing spot being edited — place marker
  if (latInput.value && lngInput.value) {
    setMarker(initLat, initLng);
  }

  // Geolocation
  locateBtn.addEventListener("click", () => {
    locateBtn.disabled = true;
    locateBtn.innerHTML = `
      <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
      Locating…`;

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      resetLocateBtn();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 17);
        setMarker(latitude, longitude);
        resetLocateBtn();
      },
      (err) => {
        alert(
          "Unable to get your location. Please click on the map to place the pin manually.",
        );
        resetLocateBtn();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  });

  function resetLocateBtn() {
    locateBtn.disabled = false;
    locateBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg> Use My Location`;
  }

  // Auto-detect on page load
  if (!latInput.value) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          map.setView([latitude, longitude], 15);
        },
        () => {
          /* silent fail — stay on default view */
        },
        {
          timeout: 5000,
        },
      );
    }
  }

  // PHOTO UPLOAD WITH PREVIEW
  const photoGrid = document.getElementById("photo-grid");

  // Click on photo slot to trigger file input
  photoGrid.addEventListener("click", (e) => {
    const slot = e.target.closest(".photo-slot");
    if (!slot) return;

    // If clicking remove button
    if (e.target.closest(".remove-preview")) {
      e.stopPropagation();
      removePhoto(slot);
      return;
    }

    const fileInput = slot.querySelector('input[type="file"]');
    if (fileInput) fileInput.click();
  });

  // Listen for file changes on all file inputs
  photoGrid.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", function () {
      const slot = this.closest(".photo-slot");
      if (!this.files || !this.files[0]) return;

      const file = this.files[0];
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file.");
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        // Remove any existing preview
        slot.querySelectorAll(".preview-img").forEach((img) => img.remove());

        const img = document.createElement("img");
        img.src = e.target.result;
        img.className = "preview-img";
        img.alt = "Spot photo preview";
        slot.prepend(img);
        slot.classList.add("has-image");
        slot.style.borderStyle = "solid";
        slot.style.borderColor = "rgba(var(--brand-primary), 0.3)";
      };
      reader.readAsDataURL(file);
    });
  });

  function removePhoto(slot) {
    slot.querySelectorAll(".preview-img").forEach((img) => img.remove());
    slot.classList.remove("has-image");
    slot.style.borderStyle = "";
    slot.style.borderColor = "";

    const fileInput = slot.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = "";

    // Check the DELETE checkbox if it's an existing image being removed
    const deleteCheck = slot.querySelector('input[name$="-DELETE"]');
    if (deleteCheck) deleteCheck.checked = true;
  }

  // STYLE DJANGO TEXTAREA AND SELECT
  document.querySelectorAll("#spot-wizard-form textarea").forEach((ta) => {
    ta.className =
      "w-full py-3 px-6 text-sm rounded-2xl bg-card border border-border-2 focus:border-brand-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground resize-none";
  });
  document.querySelectorAll("#spot-wizard-form select").forEach((sel) => {
    if (sel.id !== "id_vehicle_size") {
      sel.className =
        "w-full py-3 px-6 text-sm rounded-full bg-card border border-border-2 focus:border-brand-primary focus:ring-1 focus:ring-primary outline-none transition-all text-foreground";
    }
  });
});
