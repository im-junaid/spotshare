function toggleMobileDrawer() {
  const drawer = document.getElementById("mobile-drawer");
  const backdrop = document.getElementById("drawer-backdrop");

  const isOpen = drawer.classList.contains("translate-x-0");

  drawer.classList.toggle("translate-x-0", !isOpen);
  drawer.classList.toggle("translate-x-full", isOpen);

  backdrop.classList.toggle("opacity-100", !isOpen);
  backdrop.classList.toggle("opacity-0", isOpen);
  backdrop.classList.toggle("pointer-events-auto", !isOpen);
  backdrop.classList.toggle("pointer-events-none", isOpen);

  document.body.style.overflow = isOpen ? "" : "hidden";

  // if (window.lenis) {
  //   isOpen ? window.lenis.start() : window.lenis.stop();
  // }
}

document
  .getElementById("open-mobile-drawer")
  .addEventListener("click", toggleMobileDrawer);
document
  .getElementById("close-mobile-drawer")
  .addEventListener("click", toggleMobileDrawer);

document
  .getElementById("drawer-backdrop")
  .addEventListener("click", toggleMobileDrawer);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const drawer = document.getElementById("mobile-drawer");
    if (drawer.classList.contains("translate-x-0")) {
      toggleMobileDrawer();
    }
  }
});
