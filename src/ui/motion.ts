import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function setupMotion(): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sections = document.querySelectorAll<HTMLElement>("[data-animate]");

  if (reduce) {
    sections.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  sections.forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 28,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 82%",
      },
    });
  });
}
//test