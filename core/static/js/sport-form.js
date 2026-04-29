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
        if (window.SpotToast) SpotToast.error("Please click on the map to set your parking spot location.");
        else alert("Please click on the map to set your parking spot location.");
        return false;
      }
      if (!addr) {
        if (window.SpotToast) SpotToast.error("Please enter the street address.");
        else alert("Please enter the street address.");
        document.getElementById("id_address").focus();
        return false;
      }
    }
    if (step === 1) {
      const title = document.getElementById("id_title").value.trim();
      if (!title) {
        if (window.SpotToast) SpotToast.error("Please enter a title for your spot.");
        else alert("Please enter a title for your spot.");
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

  // LEAFLET MAP (using shared SpotMap module)
  const latInput = document.getElementById("id_latitude");
  const lngInput = document.getElementById("id_longitude");
  const coordsDisplay = document.getElementById("coords-display");
  const locateBtn = document.getElementById("locate-btn");
  const searchInput = document.getElementById("map-search");
  const resultsBox = document.getElementById("search-results");

  let initLat = latInput.value ? parseFloat(latInput.value) : 9.9312;
  let initLng = lngInput.value ? parseFloat(lngInput.value) : 76.2673;
  let initZoom = latInput.value ? 17 : 12;

  const map = SpotMap.create("map", {
    center: [initLat, initLng],
    zoom: initZoom,
    style: "voyager",
  });
  window._spotMap = map;

  // SEARCH
  const performSearch = SpotMap.debounce(async (query) => {
    const data = await SpotMap.searchPlaces(query, 5);
    if (!data.length) {
      resultsBox.classList.add("hidden");
      return;
    }
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
  const pinIcon = SpotMap.pinIcon();

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
  map.on("click", async (e) => {
    setMarker(e.latlng.lat, e.latlng.lng);
    const addr = await SpotMap.reverseGeocode(e.latlng.lat, e.latlng.lng);
    if (addr) {
      if (searchInput) searchInput.value = addr;
      const addrInput = document.getElementById("id_address");
      if (addrInput) addrInput.value = addr;
    }
  });

  // Existing spot being edited — place marker
  if (latInput.value && lngInput.value) {
    setMarker(initLat, initLng);
  }

  // Geolocation button
  locateBtn.addEventListener("click", () => {
    locateBtn.disabled = true;
    locateBtn.innerHTML = `
      <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
      Locating…`;

    SpotMap.geolocate({
      onSuccess: async (latitude, longitude) => {
        map.setView([latitude, longitude], 17);
        setMarker(latitude, longitude);
        const addr = await SpotMap.reverseGeocode(latitude, longitude);
        if (addr) {
          if (searchInput) searchInput.value = addr;
          const addrInput = document.getElementById("id_address");
          if (addrInput) addrInput.value = addr;
        }
        resetLocateBtn();
      },
      onError: (msg) => {
        if (window.SpotToast) SpotToast.error(msg + ". Please click on the map to place the pin manually.");
        else alert(msg);
        resetLocateBtn();
      },
      options: { enableHighAccuracy: true, timeout: 10000 },
    });
  });

  function resetLocateBtn() {
    locateBtn.disabled = false;
    locateBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg> Use My Location`;
  }

  // Auto-detect on page load
  if (!latInput.value) {
    SpotMap.geolocate({
      onSuccess: async (latitude, longitude) => {
        map.setView([latitude, longitude], 17);
        setMarker(latitude, longitude);
        const addr = await SpotMap.reverseGeocode(latitude, longitude);
        if (addr) {
          if (searchInput) searchInput.value = addr;
          const addrInput = document.getElementById("id_address");
          if (addrInput) addrInput.value = addr;
        }
      },
      options: { timeout: 5000 },
    });
  }

  // PHOTO UPLOAD WITH PREVIEW
  const photoGrid = document.getElementById("photo-grid");
  const addMoreBtn = document.getElementById("add-more-photos");
  const emptyFormTemplate = document.getElementById("empty-form-template");
  const totalFormsInput = document.getElementById("id_images-TOTAL_FORMS");
  const MAX_FORMS = 8;

  if (addMoreBtn && emptyFormTemplate && totalFormsInput) {
    addMoreBtn.addEventListener("click", () => {
      let currentFormCount = parseInt(totalFormsInput.value);
      if (currentFormCount >= MAX_FORMS) {
        if (window.SpotToast) {
          SpotToast.warning("You can only add up to 8 photos.");
        } else {
          alert("You can only add up to 8 photos.");
        }
        return;
      }

      const newFormHtml = emptyFormTemplate.innerHTML.replace(
        /__prefix__/g,
        currentFormCount,
      );
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = newFormHtml;
      const newSlot = tempDiv.firstElementChild;

      photoGrid.appendChild(newSlot);
      totalFormsInput.value = currentFormCount + 1;

      if (currentFormCount + 1 >= MAX_FORMS) {
        addMoreBtn.style.display = "none";
      }
    });
  }

  function handlePreview(input, slot) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.type && !file.type.startsWith("image/")) {
      if (window.SpotToast) SpotToast.error("Please select an image file.");
      else alert("Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      slot.querySelectorAll(".preview-img").forEach((img) => img.remove());
      const img = document.createElement("img");
      img.src = e.target.result;
      img.className = "preview-img";
      img.alt = "Spot photo preview";
      slot.prepend(img);
      slot.classList.add("has-image");
      const placeholder = slot.querySelector(".placeholder-ui");
      if (placeholder) placeholder.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  if (photoGrid) {
    photoGrid.addEventListener("click", function (e) {
      const removeBtn = e.target.closest(".remove-preview");
      if (removeBtn) {
        e.stopPropagation();
        const slot = removeBtn.closest(".photo-slot");
        const fileInput = slot.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = "";
        const deleteObj = slot.querySelector(
          'input[type="checkbox"][name$="-DELETE"]',
        );
        if (deleteObj) deleteObj.checked = true;
        const img = slot.querySelector("img.preview-img");
        if (img) img.remove();
        const placeholder = slot.querySelector(".placeholder-ui");
        if (placeholder) placeholder.style.display = "flex";
        slot.classList.remove("has-image");
        return;
      }
      const slot = e.target.closest(".photo-slot");
      if (slot) {
        const fileInput = slot.querySelector('input[type="file"]');
        if (fileInput && e.target !== fileInput) {
          fileInput.click();
        }
      }
    });

    photoGrid.addEventListener("change", function (e) {
      if (
        e.target.tagName.toLowerCase() === "input" &&
        e.target.type === "file"
      ) {
        const slot = e.target.closest(".photo-slot");
        handlePreview(e.target, slot);
      }
    });
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

  // WIZARD FINAL SUBMIT VALIDATION
  const wizardForm = document.getElementById("spot-wizard-form");
  if (wizardForm) {
    wizardForm.addEventListener("submit", function (e) {
      // Validate text/map fields
      const requiredFields = [
        { id: "id_address", name: "Address", step: 0 },
        { id: "id_latitude", name: "Map Location", step: 0 },
        { id: "id_longitude", name: "Map Location", step: 0 },
        { id: "id_title", name: "Spot Title", step: 1 },
        { id: "id_description", name: "Description", step: 1 },
        { id: "id_base_rate_per_hour", name: "Rate (₹/hour)", step: 1 },
      ];

      for (let field of requiredFields) {
        const el = document.getElementById(field.id);
        if (!el || !el.value.trim()) {
          e.preventDefault();
          if (window.SpotToast) {
            SpotToast.error(`Please provide ${field.name}`);
          } else {
            alert(`Please provide ${field.name}`);
          }
          goToStep(field.step);
          if (el && el.type !== "hidden") el.focus();
          return;
        }
      }

      // Validate images
      const slots = Array.from(photoGrid.querySelectorAll(".photo-slot"));
      let validImageCount = 0;
      let selectedFiles = new Set();

      for (const slot of slots) {
        const deleteCheckbox = slot.querySelector(
          'input[type="checkbox"][name$="-DELETE"]',
        );

        if (slot.classList.contains("has-image")) {
          validImageCount++;
          // Ensure we don't accidentally tell Django to delete this image
          if (deleteCheckbox) deleteCheckbox.checked = false;
        } else {
          // Tell Django to ignore or delete this empty slot
          if (deleteCheckbox) deleteCheckbox.checked = true;
          continue;
        }

        // Prevent duplicate local file uploads
        const fileInput = slot.querySelector('input[type="file"]');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const fileSig = file.name + "|" + file.size;
          if (selectedFiles.has(fileSig)) {
            e.preventDefault();
            if (window.SpotToast) {
              SpotToast.error(
                "You have selected the same image multiple times. Please choose unique images.",
              );
            } else {
              alert(
                "You have selected the same image multiple times. Please choose unique images.",
              );
            }
            goToStep(2);
            return;
          }
          selectedFiles.add(fileSig);
        }
      }

      if (validImageCount < 2) {
        e.preventDefault();
        if (window.SpotToast) {
          SpotToast.error("Please provide at least 2 photos for your spot.");
        } else {
          alert("Please provide at least 2 photos for your spot.");
        }
        goToStep(2);
        return;
      }
    });
  }
});
