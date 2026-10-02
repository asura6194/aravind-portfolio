const STORAGE_KEY = "theme";

type Theme = "light" | "dark";

/**
 * The initial theme is set synchronously by an inline script in index.html
 * (before first paint, to avoid a flash) — this just wires up the toggle.
 */
export function setupThemeToggle(): void {
  const toggle = document.querySelector<HTMLButtonElement>(".theme-toggle");
  if (!toggle) return;

  const sync = () => {
    const theme = (document.documentElement.getAttribute("data-theme") ??
      "dark") as Theme;
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
    toggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );
  };

  sync();

  toggle.addEventListener("click", () => {
    const current = (document.documentElement.getAttribute("data-theme") ??
      "dark") as Theme;
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    sync();
    window.dispatchEvent(new CustomEvent("themechange"));
  });
}
