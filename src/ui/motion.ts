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
    const timelineFill = document.querySelector<HTMLElement>(".timeline-fill");
    if (timelineFill) timelineFill.style.transform = "scaleY(1)";
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

  const heroMedia = document.querySelector(".hero-media");
  if (heroMedia) {
    gsap.to(heroMedia, {
      yPercent: 10,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  }

  const timelineFill = document.querySelector(".timeline-fill");
  if (timelineFill) {
    gsap.to(timelineFill, {
      scaleY: 1,
      ease: "none",
      scrollTrigger: {
        trigger: ".timeline",
        start: "top 75%",
        end: "bottom 60%",
        scrub: true,
      },
    });
  }
}