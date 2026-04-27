document.addEventListener("DOMContentLoaded", () => {
  // 1. Scroll Reveal Observer
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.1,
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll(".animate-on-scroll").forEach((el) => {
    revealObserver.observe(el);
  });

  // 2. Counter Animation
  function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      obj.innerHTML = Math.floor(
        easeProgress * (end - start) + start,
      ).toLocaleString();
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  const counterObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target.getAttribute("data-target");
          if (target) {
            animateValue(entry.target, 0, parseInt(target), 2000);
            observer.unobserve(entry.target);
          }
        }
      });
    },
    { threshold: 0.5 },
  );

  document.querySelectorAll(".counter-val").forEach((el) => {
    counterObserver.observe(el);
  });

  // 3. Simple Parallax
  const heroBgs = document.querySelectorAll(".page-hero-bg, .parallax-bg");
  if (heroBgs.length > 0) {
    if (window.lenis) {
      window.lenis.on("scroll", (e) => {
        heroBgs.forEach((bg) => {
          const speed = bg.getAttribute("data-speed") || 0.4;
          const yPos = -(e.scroll * speed);
          bg.style.transform = `translate3d(0px, ${yPos}px, 0px)`;
        });
      });
    } else {
      window.addEventListener("scroll", () => {
        const scrollY = window.scrollY;
        heroBgs.forEach((bg) => {
          const speed = bg.getAttribute("data-speed") || 0.4;
          const yPos = -(scrollY * speed);
          bg.style.transform = `translate3d(0px, ${yPos}px, 0px)`;
        });
      });
    }
  }
});
