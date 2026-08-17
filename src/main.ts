import "./styles/main.css";
import { canCreateWebGL, createHeroScene } from "./scene/heroScene";
import { setupMotion } from "./ui/motion";
import { setupNav } from "./ui/nav";
import { renderPage } from "./ui/render";

renderPage();
setupNav();
setupMotion();

const canvas = document.querySelector<HTMLCanvasElement>("#hero-canvas");
const fallback = document.querySelector<HTMLElement>(".hero-fallback");

if (canvas && canCreateWebGL()) {
  try {
    createHeroScene(canvas);
  } catch {
    canvas.remove();
    if (fallback) fallback.hidden = false;
  }
} else {
  canvas?.remove();
  if (fallback) fallback.hidden = false;
}
