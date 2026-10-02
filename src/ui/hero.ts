import gsap from "gsap";

/** Staggers the pre-split hero name in, letter by letter. */
function animateName(hero: HTMLElement): void {
  const chars = hero.querySelectorAll(".split-char");
  if (!chars.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  gsap.from(chars, {
    yPercent: 110,
    opacity: 0,
    duration: 0.6,
    ease: "power3.out",
    stagger: 0.025,
  });
}

export function setupHero(): void {
  const hero = document.querySelector<HTMLElement>(".hero");
  if (!hero) return;
  animateName(hero);
}
