import "./styles/main.css";
import { canCreateWebGL, createDustScene } from "./scene/dustScene";
import { setupCustomCursor } from "./ui/cursor";
import { setupHexPanels } from "./ui/hexPanels";
import { setupLoadingScreen } from "./ui/loadingScreen";
import { setupMotion } from "./ui/motion";
import { setupNav } from "./ui/nav";
import { renderPage } from "./ui/render";
import { setupThemeToggle } from "./ui/theme";

renderPage();
setupNav();
setupThemeToggle();
setupCustomCursor();

const bootPage = () => {
  setupHexPanels();
  setupMotion();

  const canvas = document.querySelector<HTMLCanvasElement>("#dust-canvas");

  const startDust = () => {
    if (canvas && canCreateWebGL()) {
      try {
        createDustScene(canvas, canvas);
      } catch {
        canvas.remove();
      }
    } else {
      canvas?.remove();
    }
  };

  requestAnimationFrame(startDust);
};

void setupLoadingScreen().then(bootPage);
