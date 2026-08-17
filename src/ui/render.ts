import {
  education,
  experience,
  featured,
  profile,
  skills,
} from "../content";

export function renderPage(): void {
  setText("[data-hero-eyebrow]", profile.location);
  setText("[data-hero-name]", profile.name);
  setText("[data-hero-title]", profile.title);
  setText("[data-hero-summary]", profile.summary);
  setText("[data-about]", profile.summary);
  setText("[data-edu-degree]", education.degree);
  setText(
    "[data-edu-meta]",
    `${education.school} · ${education.period} · ${education.location}`,
  );
  setText("[data-edu-gpa]", `CGPA ${education.gpa}`);
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
          <h3>${escapeHtml(job.role)}</h3>
          <p class="job-meta">${escapeHtml(job.company)} · ${escapeHtml(job.period)} · ${escapeHtml(job.location)}</p>
          <ul>
            ${job.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
          </ul>
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

  const featuredRoot = document.querySelector("[data-featured]");
  if (featuredRoot) {
    featuredRoot.innerHTML = `
      <p class="eyebrow">${featured.tags.map(escapeHtml).join(" · ")}</p>
      <h3>${escapeHtml(featured.title)}</h3>
      <p>${escapeHtml(featured.description)}</p>
    `;
  }

  const contact = document.querySelector("[data-contact]");
  if (contact) {
    contact.innerHTML = `
      <li><a href="mailto:${profile.email}">${escapeHtml(profile.email)}</a></li>
      <li><a href="tel:${profile.phone.replace(/\s+/g, "")}">${escapeHtml(profile.phone)}</a></li>
      <li><a href="${profile.linkedin}" target="_blank" rel="noreferrer">${escapeHtml(profile.linkedinLabel)}</a></li>
      <li><a href="/Aravind.pdf" download>Download resume (PDF)</a></li>
    `;
  }
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
