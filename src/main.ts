import "./styles/main.css";
import { canCreateWebGL, createDustScene } from "./scene/dustScene";
import { setupHexPanels } from "./ui/hexPanels";
import { setupLoadingScreen } from "./ui/loadingScreen";
import { setupMotion } from "./ui/motion";
import { setupNav } from "./ui/nav";
import { renderPage } from "./ui/render";

renderPage();
setupNav();

const bootPage = () => {
  setupHexPanels();
  setupMotion();

  const canvas = document.querySelector<HTMLCanvasElement>("#dust-canvas");
  const host = document.querySelector<HTMLElement>("#page-body");
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

void setupLoadingScreen().then(bootPage);
