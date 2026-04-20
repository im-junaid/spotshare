// core/static/js/base.js

/**
 * THEME TOGGLE funtions
 * @param {boolean} isLight - boolean for is light theme now or not
 */
function updateIcons(isLight) {
  const sunIcons = document.querySelectorAll(".sun-icon");
  const moonIcons = document.querySelectorAll(".moon-icon");

  sunIcons.forEach((icon) => {
    isLight ? icon.classList.add("hidden") : icon.classList.remove("hidden");
  });

  moonIcons.forEach((icon) => {
    isLight ? icon.classList.remove("hidden") : icon.classList.add("hidden");
  });
}

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  updateIcons(isLight);
}

/**
 * Gets a cookie value by name (e.g., 'csrftoken')
 */
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

/**
 * Global Validation Rules
 */
const globalValidate = {
  email: (v) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v),
  phone: (v) => v && v.trim().length >= 10,
  full_name: (v) => v && v.trim().length >= 4,
};

document.addEventListener("DOMContentLoaded", () => {
  const htmlElement = document.documentElement;

  const isLightInitial = htmlElement.classList.contains("light");
  updateIcons(isLightInitial);

  // --- MOBILE DRAWER ELEMENTS ---
  const drawer = document.getElementById("mobile-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const openBtn = document.getElementById("open-mobile-drawer");
  const closeBtn = document.getElementById("close-mobile-drawer");

  /**
   * TOGGLE SIDE BAR (Mobile Drawer)
   */
  function toggleMobileDrawer() {
    if (!drawer || !backdrop) return;

    const isOpening = drawer.classList.contains("translate-x-full");

    if (isOpening) {
      // OPEN STATE
      drawer.classList.replace("translate-x-full", "translate-x-0");
      backdrop.classList.replace("opacity-0", "opacity-100");
      backdrop.classList.replace("pointer-events-none", "pointer-events-auto");
      document.body.style.overflow = "hidden";
      // if (window.lenis) window.lenis.stop();
    } else {
      // CLOSE STATE
      drawer.classList.replace("translate-x-0", "translate-x-full");
      backdrop.classList.replace("opacity-100", "opacity-0");
      backdrop.classList.replace("pointer-events-auto", "pointer-events-none");
      document.body.style.overflow = "";
      // if (window.lenis) window.lenis.start();
    }
  }

  // Drawer Controls
  if (openBtn) openBtn.addEventListener("click", toggleMobileDrawer);
  if (closeBtn) closeBtn.addEventListener("click", toggleMobileDrawer);
  if (backdrop) backdrop.addEventListener("click", toggleMobileDrawer);

  // Close Drawer on Escape Key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer?.classList.contains("translate-x-0")) {
      toggleMobileDrawer();
    }
  });
});
