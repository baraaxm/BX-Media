#!/usr/bin/env node
/*
 * build-projects.js  (zero dependencies, run locally: `node tools/build-projects.js`)
 *
 * Reads data/projects.json and regenerates, with NO visible change to the site:
 *   - /work/<slug>/index.html        static project pages (same markup/CSS as project-details.html)
 *   - index.html projects grid        static cards between <!-- PROJECTS:START/END --> markers
 *   - sitemap.xml                     homepage + every /work/ page
 *   - llms.txt                        plain-text summary for AI crawlers
 *
 * Netlify serves the committed output as-is. There is no build step on deploy.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DOMAIN = "https://bx.media";
const ENTITY = "BX Media Automotive";

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, s) => {
  const full = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, s);
};

const data = JSON.parse(read("data/projects.json"));
const projects = data.projects;

/* ---------- helpers ---------- */

// Escape for HTML text / double-quoted attributes.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Machine-readable copy must not contain em/en dashes (they become commas).
function noDash(s) {
  return String(s == null ? "" : s)
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",");
}

// Meta description: first sentence of the (dash-normalized) description, <=155 chars.
function metaDescription(desc) {
  const s = noDash(desc).trim();
  const m = s.match(/^(.*?[.!?])(\s|$)/);
  let out = m ? m[1] : s;
  if (out.length > 155) out = out.slice(0, 152).replace(/\s+\S*$/, "") + "...";
  return out.trim();
}

function absImage(img) {
  return DOMAIN + "/" + String(img).replace(/^\/+/, "");
}

function gitLastmod(file) {
  try {
    const iso = execSync(`git log -1 --format=%cI -- "${file}"`, {
      cwd: ROOT,
    })
      .toString()
      .trim();
    if (iso) return iso.slice(0, 10);
  } catch (e) {
    /* not committed yet */
  }
  return new Date().toISOString().slice(0, 10);
}

// Reuse the exact CSS + Vimeo player include from the current detail page,
// so generated pages are visually identical.
const detailSrc = read("project-details.html");
const styleBlock = (detailSrc.match(/<style>[\s\S]*?<\/style>/) || ["<style></style>"])[0];

/* ---------- per-project work page ---------- */

function videoIframe(src, titleAttr, extraClass) {
  return (
    `<iframe src="${esc(src)}" allow="autoplay; fullscreen; picture-in-picture" ` +
    `allowfullscreen loading="lazy" title="${esc(titleAttr)}"></iframe>`
  );
}

function buildGallery(p) {
  const first = p.videos[0];
  const firstTall = first && first.aspect === "portrait" ? " tall" : "";
  const main =
    `<div class="video-main">\n` +
    `          <div class="video-wrapper${firstTall}">\n` +
    `            ${videoIframe(first.src, p.detailTitle + ": " + first.title)}\n` +
    `          </div>\n` +
    `        </div>`;

  const thumbs = p.videos
    .map((v, i) => {
      const tall = v.aspect === "portrait" ? " tall" : "";
      const active = i === 0 ? " is-active" : "";
      return (
        `          <button class="video-thumb${tall}${active}" data-index="${i}" ` +
        `aria-label="${esc(v.title || "Video")}" style="--index: ${i}">` +
        `${videoIframe(v.src, p.detailTitle + ": " + v.title)}</button>`
      );
    })
    .join("\n");

  return (
    `<div class="video-gallery">\n` +
    `        <h3 style="text-align: center; margin: 0 0 10px; color: #fff;">${esc(first.title || "")}</h3>\n` +
    `        ${main}\n` +
    `        <div class="video-thumbs" aria-label="More videos">\n${thumbs}\n        </div>\n` +
    `      </div>`
  );
}

function galleryScript(p) {
  const mini = p.videos.map((v) => ({ t: v.title || "", s: v.src, a: v.aspect || "landscape" }));
  return `<script>
(function () {
  var DT = ${JSON.stringify(p.detailTitle)};
  var videos = ${JSON.stringify(mini)};
  var gallery = document.querySelector('.video-gallery');
  if (!gallery) return;
  var main = gallery.querySelector('.video-main');
  var titleEl = gallery.querySelector('h3');
  var thumbs = gallery.querySelector('.video-thumbs');
  if (!main || !thumbs) return;
  var current = 0;
  function render(i) {
    var v = videos[i];
    if (!v || i === current) return;
    current = i;
    var tall = v.a === 'portrait' ? ' tall' : '';
    if (titleEl) titleEl.textContent = v.t || '';
    main.innerHTML = '<div class="video-wrapper' + tall + '"><iframe src="' + v.s +
      '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" title="' +
      (DT + ': ' + (v.t || '')).replace(/"/g, '&quot;') + '"></iframe></div>';
    thumbs.querySelectorAll('.video-thumb').forEach(function (b) {
      b.classList.toggle('is-active', Number(b.dataset.index) === i);
    });
    if (window.matchMedia('(max-width: 768px)').matches) {
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  thumbs.querySelectorAll('.video-thumb').forEach(function (btn) {
    btn.addEventListener('click', function () { render(Number(btn.dataset.index)); });
  });
})();
</script>`;
}

function workJsonLd(p) {
  const url = `${DOMAIN}/work/${p.slug}/`;
  const img = absImage(p.image);
  const keywords = []
    .concat(p.year ? [String(p.year)] : [])
    .concat(p.services || [])
    .concat(p.deliverables || []);

  const creativeWork = {
    "@type": "CreativeWork",
    "@id": url + "#work",
    name: p.detailTitle,
    description: noDash(p.description),
    url: url,
    creator: { "@id": `${DOMAIN}/#org` },
    locationCreated: { "@type": "Place", name: `${p.location}, Saudi Arabia` },
    about: { "@type": "Organization", name: p.client },
    image: img,
  };
  if (p.year) creativeWork.dateCreated = String(p.year);
  if (keywords.length) creativeWork.keywords = keywords.join(", ");
  creativeWork.video = p.videos.map((v) => {
    const vo = {
      "@type": "VideoObject",
      name: p.detailTitle + ": " + v.title,
      description: noDash(p.description),
      embedUrl: v.src,
      thumbnailUrl: img,
    };
    if (v.uploadDate) vo.uploadDate = v.uploadDate;
    return vo;
  });

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${DOMAIN}/` },
      { "@type": "ListItem", position: 2, name: "Work", item: `${DOMAIN}/#projects` },
      { "@type": "ListItem", position: 3, name: p.detailTitle, item: url },
    ],
  };

  return JSON.stringify({ "@context": "https://schema.org", "@graph": [creativeWork, breadcrumb] }, null, 2);
}

function buildWorkPage(p) {
  const url = `${DOMAIN}/work/${p.slug}/`;
  const meta = metaDescription(p.description);
  const img = absImage(p.image);
  const title = `${p.detailTitle} | ${ENTITY}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(meta)}">
  <link rel="canonical" href="${url}" />
  <link rel="stylesheet" href="/style.css" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://player.vimeo.com/api/player.js"></script>

  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(meta)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${esc(img)}" />
  <meta property="og:site_name" content="${ENTITY}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(meta)}" />
  <meta name="twitter:image" content="${esc(img)}" />

  ${styleBlock}

  <script type="application/ld+json">
${workJsonLd(p)}
  </script>
</head>
<body>
  <div class="container">
    <a href="/#projects" class="back-link">Back to Projects</a>
    <section id="projectDetails" class="project-detail-container">
      <h1>${esc(p.detailTitle)}</h1>
      <p>${esc(p.description)}</p>
      ${buildGallery(p)}
    </section>
  </div>

  ${galleryScript(p)}
</body>
</html>
`;
}

/* ---------- homepage grid cards ---------- */

function buildGridCards() {
  return projects
    .map((p, i) => {
      return `        <div class="project-card reveal-on-scroll" style="--index: ${i}">
          <div class="project-image">
            <img src="${esc(p.image)}" alt="${esc(p.gridTitle)}" loading="lazy" />
          </div>
          <div class="project-info">
            <h3>${esc(p.gridTitle)}</h3>
            <a href="#services" class="project-category">${esc(p.category)}</a>
            <div class="project-details">
              <p><strong>Client:</strong> ${esc(p.client)}</p>
              <p><strong>Location:</strong> ${esc(p.location)}</p>
            </div>
            <a href="/work/${p.slug}/" class="project-btn">View Project</a>
          </div>
        </div>`;
    })
    .join("\n");
}

function injectGrid() {
  const file = "index.html";
  let html = read(file);
  const cards = buildGridCards();
  const replacement = `<!-- PROJECTS:START -->\n${cards}\n        <!-- PROJECTS:END -->`;
  const re = /<!-- PROJECTS:START -->[\s\S]*?<!-- PROJECTS:END -->/;
  if (!re.test(html)) {
    throw new Error("PROJECTS markers not found in index.html");
  }
  html = html.replace(re, replacement);
  write(file, html);
}

/* ---------- sitemap ---------- */

function buildSitemap() {
  const homeMod = gitLastmod("index.html");
  const projMod = gitLastmod("data/projects.json");
  const urls = [{ loc: `${DOMAIN}/`, lastmod: homeMod }].concat(
    projects.map((p) => ({ loc: `${DOMAIN}/work/${p.slug}/`, lastmod: projMod }))
  );
  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/* ---------- llms.txt ---------- */

const CLIENTS = [
  "Abdullatif Jameel", "ArabGT", "Barbican", "BYD", "Emirates Driving", "EVIQ",
  "Feynlab", "Honor", "Jameel Motorsport", "Kumho", "Lotus", "Lynk & Co", "RAM",
  "Realme", "Saudi Motorsport Federation", "Soueast", "StriveME",
  "Titanium Automotive", "TMD Friction", "Toyota", "VIP Quick Service", "Volvo",
  "Zeetex",
];

function buildLlms() {
  const services = [
    ["High-End Video & Content Production", "Video production and content creation for automotive brands."],
    ["Social Media Account Management", "Social media planning, posting, and optimization for automotive brands."],
    ["Automotive Influencer Marketing", "Influencer campaigns connecting automotive brands with creators."],
  ];
  const serviceLines = services
    .map(([n, d]) => `- [${n}](${DOMAIN}/#services): ${d}`)
    .join("\n");
  const workLines = projects
    .map(
      (p) =>
        `- [${p.detailTitle}](${DOMAIN}/work/${p.slug}/): Automotive content production for ${p.client} in ${p.location}.`
    )
    .join("\n");

  return `# ${ENTITY}

> ${ENTITY} is a Riyadh-based automotive specialist. It provides end-to-end automotive content, video production, and agency services to car brands across the GCC.

## Services
${serviceLines}

## Work
${workLines}

## Clients
${CLIENTS.join(", ")}.

## Contact
- Email: info@bx.media
- Phone: +966535096137
- WhatsApp: ${DOMAIN.replace("bx.media", "wa.me")}/966557969551
- Location: Riyadh, Saudi Arabia. Area served: GCC.
`;
}

/* ---------- run ---------- */

let pages = 0;
projects.forEach((p) => {
  write(`work/${p.slug}/index.html`, buildWorkPage(p));
  pages += 1;
});
injectGrid();
write("sitemap.xml", buildSitemap());
write("llms.txt", buildLlms());

console.log(`Generated ${pages} work pages, updated index.html grid, sitemap.xml, llms.txt.`);
projects.forEach((p) => console.log(`  /work/${p.slug}/  (${p.videos.length} videos)`));
