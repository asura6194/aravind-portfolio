import "./styles/main.css";
import { canCreateWebGL, createDustScene } from "./scene/dustScene";
import { setupHexPanels } from "./ui/hexPanels";
import { setupMotion } from "./ui/motion";
import { setupNav } from "./ui/nav";
import { renderPage } from "./ui/render";

renderPage();
setupHexPanels();
setupNav();
setupMotion();

const canvas = document.querySelector<HTMLCanvasElement>("#dust-canvas");
const host = document.querySelector<HTMLElement>("#page-body");

const startDust = () => {
  if (canvas && host && canCreateWebGL()) {
    try {
      createDustScene(canvas, host);
    } catch {
      canvas.remove();
    }
  } else {
    canvas?.remove();
  }
};

requestAnimationFrame(startDust);
