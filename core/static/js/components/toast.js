// TOAST MESSAGE HANDLER
const icons = {
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
};

const variants = {
  default: {
    border: "rgba(255,255,255,0.08)",
    icon: "rgba(250,250,250,0.6)",
    title: "rgb(250,250,250)",
    actBorder: "rgba(255,255,255,0.08)",
    actColor: "rgb(250,250,250)",
    actHover: "rgba(255,255,255,0.06)",
  },
  success: {
    border: "rgba(34,197,94,0.5)",
    icon: "#22c55e",
    title: "#22c55e",
    actBorder: "#22c55e",
    actColor: "#22c55e",
    actHover: "rgba(34,197,94,0.1)",
  },
  error: {
    border: "rgba(239,68,68,0.5)",
    icon: "#ef4444",
    title: "#ef4444",
    actBorder: "#ef4444",
    actColor: "#ef4444",
    actHover: "rgba(239,68,68,0.1)",
  },
  warning: {
    border: "rgba(245,158,11,0.5)",
    icon: "#f59e0b",
    title: "#f59e0b",
    actBorder: "#f59e0b",
    actColor: "#f59e0b",
    actHover: "rgba(245,158,11,0.1)",
  },
};

// ── Config ──
const STACK_GAP = 10;
const STACK_SCALE = 0.05;
const STACK_DIM = 0.12;
const MAX_VISIBLE = 3;
const EXPAND_GAP = 12;
const DURATION = 350;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

// ── State ──
let counter = 0;
const toasts = [];
let container = null;
let expanded = false;
let hoverTimer = null;

function mobile() {
  return window.innerWidth < 768;
}

// ── Container ──
function init() {
  if (container && document.body.contains(container)) return;
  container = document.createElement("div");
  container.id = "spotshare-toast-container";
  Object.assign(container.style, {
    position: "fixed",
    inset: "0",
    zIndex: "9999",
    pointerEvents: "none",
    overflow: "visible",
  });
  document.body.appendChild(container);
  window.addEventListener("resize", () => layout());
}

// ── Build Toast DOM ──
function buildEl(opts) {
  const {
    id,
    title,
    message,
    variant = "default",
    actions,
    onDismiss,
    highlightTitle,
  } = opts;
  const v = variants[variant] || variants.default;
  const iconKey = variant === "default" ? "info" : variant;

  const el = document.createElement("div");
  el.id = `toast-${id}`;
  el.setAttribute("role", "alert");
  Object.assign(el.style, {
    position: "absolute",
    width: "340px",
    maxWidth: "calc(100vw - 32px)",
    padding: "12px",
    borderRadius: "12px",
    border: `1px solid ${v.border}`,
    background: "#1a1a1a",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    pointerEvents: "auto",
    cursor: "default",
    willChange: "transform, opacity",
    transition: `transform ${DURATION}ms ${EASE}, opacity ${DURATION}ms ease, filter ${DURATION}ms ease`,
  });

  // Left: icon + text
  const left = document.createElement("div");
  Object.assign(left.style, {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    flex: "1",
    minWidth: "0",
  });

  const ic = document.createElement("span");
  ic.innerHTML = icons[iconKey];
  Object.assign(ic.style, {
    color: v.icon,
    flexShrink: "0",
    marginTop: "2px",
    display: "flex",
  });

  const txt = document.createElement("div");
  Object.assign(txt.style, {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: "0",
  });

  if (title) {
    const h = document.createElement("h3");
    h.textContent = title;
    Object.assign(h.style, {
      margin: "0",
      fontSize: "0.75rem",
      fontWeight: "500",
      lineHeight: "1.3",
      fontFamily: "var(--font-display, 'Onest', system-ui, sans-serif)",
      color: highlightTitle ? variants.success.title : v.title,
    });
    txt.appendChild(h);
  }
  const p = document.createElement("p");
  p.textContent = message;
  Object.assign(p.style, {
    margin: "0",
    fontSize: "0.75rem",
    lineHeight: "1.5",
    color: "rgba(250,250,250,0.6)",
  });
  txt.appendChild(p);
  left.appendChild(ic);
  left.appendChild(txt);
  el.appendChild(left);

  // Right: action + close
  const right = document.createElement("div");
  Object.assign(right.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: "0",
    marginLeft: "8px",
  });

  if (actions && actions.label) {
    const btn = document.createElement("button");
    btn.textContent = actions.label;
    Object.assign(btn.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "4px 12px",
      fontSize: "0.75rem",
      fontWeight: "500",
      fontFamily: "var(--font-body, 'Figtree', system-ui, sans-serif)",
      borderRadius: "6px",
      border: `1px solid ${v.actBorder}`,
      background: "transparent",
      color: v.actColor,
      cursor: "pointer",
      transition: "background 0.2s ease",
      whiteSpace: "nowrap",
    });
    btn.onmouseenter = () => {
      btn.style.background = v.actHover;
    };
    btn.onmouseleave = () => {
      btn.style.background = "transparent";
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      actions.onClick && actions.onClick();
      dismiss(id);
    };
    right.appendChild(btn);
  }

  const close = document.createElement("button");
  close.innerHTML = icons.close;
  close.setAttribute("aria-label", "Dismiss");
  Object.assign(close.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    color: "rgba(250,250,250,0.6)",
    cursor: "pointer",
    transition: "background 0.2s ease",
    padding: "0",
  });
  close.onmouseenter = () => {
    close.style.background = "rgba(255,255,255,0.08)";
  };
  close.onmouseleave = () => {
    close.style.background = "transparent";
  };
  close.onclick = (e) => {
    e.stopPropagation();
    dismiss(id);
    onDismiss && onDismiss();
  };
  right.appendChild(close);
  el.appendChild(right);

  // Hover → expand/collapse
  el.addEventListener("mouseenter", () => {
    clearTimeout(hoverTimer);
    if (!expanded) {
      expanded = true;
      toasts.forEach(pauseTimer);
      layout();
    }
  });
  el.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      expanded = false;
      toasts.forEach(resumeTimer);
      layout();
    }, 150);
  });

  return el;
}

// ── Timer helpers ──
function pauseTimer(t) {
  if (t.tid) {
    clearTimeout(t.tid);
    t.tid = null;
    t.remain = Math.max(0, t.dismissAt - Date.now());
  }
}
function resumeTimer(t) {
  if (t.dur > 0 && t.remain > 0) {
    t.dismissAt = Date.now() + t.remain;
    t.tid = setTimeout(() => dismiss(t.id), t.remain);
  }
}

// ── Layout: position all toasts ──
function layout() {
  const m = mobile();
  const dir = m ? -1 : 1;
  let cumY = 0;

  toasts.forEach((t, i) => {
    const el = t.element;
    if (!el || t.exiting) return;

    el.style.zIndex = String(9999 - i);

    // Anchor position
    if (m) {
      el.style.bottom = "16px";
      el.style.top = "auto";
      el.style.left = "50%";
      el.style.right = "auto";
      el.style.transformOrigin = "center bottom";
    } else {
      el.style.top = "16px";
      el.style.bottom = "auto";
      el.style.right = "16px";
      el.style.left = "auto";
      el.style.transformOrigin = "center top";
    }

    const tx = m ? "-50%" : "0";

    if (expanded) {
      el.style.transform = `translateX(${tx}) translateY(${cumY * dir}px) scale(1)`;
      el.style.opacity = "1";
      el.style.filter = "none";
      el.style.pointerEvents = "auto";
      cumY += t.h + EXPAND_GAP;
    } else {
      if (i < MAX_VISIBLE) {
        const off = i * STACK_GAP;
        const sc = 1 - i * STACK_SCALE;
        const op = 1 - i * STACK_DIM;
        el.style.transform = `translateX(${tx}) translateY(${off * dir}px) scale(${sc})`;
        el.style.opacity = String(op);
        el.style.filter = i > 0 ? `brightness(${1 - i * 0.08})` : "none";
        el.style.pointerEvents = i === 0 ? "auto" : "none";
      } else {
        const off = MAX_VISIBLE * STACK_GAP;
        const sc = 1 - MAX_VISIBLE * STACK_SCALE;
        el.style.transform = `translateX(${tx}) translateY(${off * dir}px) scale(${sc})`;
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      }
    }
  });
}

// ── Show ──
function show(opts) {
  const id = ++counter;
  const dur = opts.duration !== undefined ? opts.duration : 4000;
  init();

  const el = buildEl({ ...opts, id });
  const m = mobile();
  const dir = m ? -1 : 1;
  const tx = m ? "-50%" : "0";

  // Initial off-screen state (no transition)
  el.style.transition = "none";
  if (m) {
    el.style.bottom = "16px";
    el.style.top = "auto";
    el.style.left = "50%";
    el.style.right = "auto";
    el.style.transformOrigin = "center bottom";
  } else {
    el.style.top = "16px";
    el.style.bottom = "auto";
    el.style.right = "16px";
    el.style.left = "auto";
    el.style.transformOrigin = "center top";
  }
  el.style.transform = `translateX(${tx}) translateY(${-40 * dir}px) scale(0.9)`;
  el.style.opacity = "0";
  container.appendChild(el);

  const h = el.offsetHeight; // measure

  const t = {
    id,
    element: el,
    h,
    dur,
    tid: null,
    dismissAt: 0,
    remain: dur,
    onDismiss: opts.onDismiss,
    exiting: false,
  };
  toasts.unshift(t);

  // Animate in
  requestAnimationFrame(() => {
    el.style.transition = `transform ${DURATION}ms ${EASE}, opacity ${DURATION}ms ease, filter ${DURATION}ms ease`;
    if (dur > 0) {
      t.dismissAt = Date.now() + dur;
      t.tid = setTimeout(() => dismiss(id), dur);
    }
    layout();
  });

  // Cap at 5
  if (toasts.length > 5) dismiss(toasts[toasts.length - 1].id);
  return id;
}

// ── Dismiss ──
function dismiss(id) {
  const idx = toasts.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const t = toasts[idx];
  if (t.exiting) return;
  t.exiting = true;
  if (t.tid) clearTimeout(t.tid);

  const m = mobile();
  const dir = m ? -1 : 1;
  const tx = m ? "-50%" : "0";
  t.element.style.transform = `translateX(${tx}) translateY(${-30 * dir}px) scale(0.9)`;
  t.element.style.opacity = "0";
  t.element.style.pointerEvents = "none";

  setTimeout(() => {
    if (t.element.parentNode) t.element.parentNode.removeChild(t.element);
    toasts.splice(toasts.indexOf(t), 1);
    layout(); // smooth reposition remaining
  }, DURATION);
}

function dismissAll() {
  [...toasts].forEach((t) => dismiss(t.id));
}

// ── Public API ──
window.SpotToast = {
  show,
  dismiss,
  dismissAll,
  success: (msg, o = {}) => show({ variant: "success", message: msg, ...o }),
  error: (msg, o = {}) => show({ variant: "error", message: msg, ...o }),
  warning: (msg, o = {}) => show({ variant: "warning", message: msg, ...o }),
  info: (msg, o = {}) => show({ variant: "default", message: msg, ...o }),
};
