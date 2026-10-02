/** Desktop-only — touch devices have no persistent pointer to track. */
export function setupCustomCursor(): void {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const dot = document.createElement("div");
  dot.className = "custom-cursor";
  dot.setAttribute("aria-hidden", "true");
  document.body.appendChild(dot);

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let x = targetX;
  let y = targetY;

  window.addEventListener(
    "pointermove",
    (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      dot.classList.add("is-visible");
    },
    { passive: true },
  );

  window.addEventListener("pointerleave", () => dot.classList.remove("is-visible"));

  document.addEventListener("mouseover", (event) => {
    const hovering = (event.target as HTMLElement).closest(
      "a, button, [role='button']",
    );
    dot.classList.toggle("is-hover", Boolean(hovering));
  });

  const tick = () => {
    x += (targetX - x) * 0.22;
    y += (targetY - y) * 0.22;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
