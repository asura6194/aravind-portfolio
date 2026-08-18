import { assetUrl } from "../assetUrl";
import {
  education,
  experience,
  profile,
  skills,
  type JobPoint,
} from "../content";

export function renderPage(): void {
  setText("[data-hero-eyebrow]", profile.location);
  setText("[data-hero-name]", profile.name);
  setText("[data-hero-title]", profile.title);
  setText("[data-hero-summary]", profile.summary);
  renderAbout();
  setText("[data-edu-degree]", education.degree);
  setText(
    "[data-edu-meta]",
    `${education.school} · ${education.period} · ${education.location}`,
  );
  setText(
    "[data-footer]",
    `© ${new Date().getFullYear()} ${profile.name}`,
  );

  const timeline = document.querySelector("[data-experience]");
  if (timeline) {
    timeline.innerHTML = experience
      .map(
        (job) => `
        <li>
          <div class="job-head">
            <div>
              <h3>${escapeHtml(job.company)}</h3>
              <p class="job-meta">${escapeHtml(job.location)}</p>
            </div>
            <img class="job-logo" src="${escapeHtml(assetUrl(job.logo))}" alt="${escapeHtml(job.logoAlt)}" />
          </div>
          ${job.roles
            .map(
              (role) => `
            <section class="job-role">
              <h4>${escapeHtml(role.title)}</h4>
              <p class="job-meta">${escapeHtml(role.period)}</p>
              <ul>
                ${role.points.map((point) => renderPoint(point)).join("")}
              </ul>
            </section>`,
            )
            .join("")}
        </li>`,
      )
      .join("");
  }

  const skillsRoot = document.querySelector("[data-skills]");
  if (skillsRoot) {
    skillsRoot.innerHTML = Object.entries(skills)
      .map(
        ([group, items]) => `
        <article class="skill-group">
          <h3>${escapeHtml(group)}</h3>
          <ul class="chips">
            ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>`,
      )
      .join("");
  }

  const contact = document.querySelector("[data-contact]");
  if (contact) {
    contact.innerHTML = `
      <li><a href="mailto:${profile.email}">${escapeHtml(profile.email)}</a></li>
      <li><a href="tel:${profile.phone.replace(/\s+/g, "")}">${escapeHtml(profile.phone)}</a></li>
      <li><a href="${profile.linkedin}" target="_blank" rel="noreferrer">${escapeHtml(profile.linkedinLabel)}</a></li>
      <li><a href="${escapeHtml(assetUrl("Aravind.pdf"))}" download>Download resume (PDF)</a></li>
    `;
  }
}

function renderPoint(point: JobPoint): string {
  if (!point.href) {
    return `<li>${escapeHtml(point.text)}</li>`;
  }
  return `<li>${escapeHtml(point.text)} <a href="${escapeHtml(point.href)}" target="_blank" rel="noreferrer">${escapeHtml(point.hrefLabel ?? point.href)}</a></li>`;
}

function renderAbout(): void {
  const el = document.querySelector("[data-about]");
  if (!el) return;
  el.innerHTML = profile.about
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function setText(selector: string, value: string): void {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
