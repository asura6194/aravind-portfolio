const STORAGE_KEY = "theme";

type Theme = "light" | "dark";

/**
 * The initial theme is set synchronously by an inline script in index.html
 * (before first paint, to avoid a flash) — this just wires up the toggle.
 */
export function setupThemeToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>(".theme-toggle");
  const label = toggle?.querySelector<HTMLElement>(".theme-toggle-label");
  if (!toggle) return;

  const sync = () => {
    const theme = (document.documentElement.getAttribute("data-theme") ??
      "dark") as Theme;
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
    toggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );
    if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
  };

  sync();

  toggle.addEventListener("click", () => {
    const current = (document.documentElement.getAttribute("data-theme") ??
      "dark") as Theme;
    const next: Theme = current === "dark" ? "light" : "dark";

    const apply = () => {
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(STORAGE_KEY, next);
      sync();
      window.dispatchEvent(new CustomEvent("themechange"));
    };

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!document.startViewTransition || reduceMotion) {
      apply();
      return;
    }

    // Native API, no library: the new theme reveals through a hexagon
    // expanding from screen centre instead of an instant colour swap —
    // reuses the loader's hex motif for the toggle too.
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    const radius = Math.hypot(x, y);
    const hexagon = (r: number) => {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 180) * (60 * i - 90);
        return `${x + r * Math.cos(a)}px ${y + r * Math.sin(a)}px`;
      });
      return `polygon(${pts.join(", ")})`;
    };

    const transition = document.startViewTransition(apply);
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [hexagon(0), hexagon(radius)] },
        { duration: 650, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
      );
    });
  });
}
