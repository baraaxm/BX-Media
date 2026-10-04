#!/usr/bin/env node
/*
 * build-site.js  (zero dependencies, run locally: `node tools/build-site.js`)
 *
 * Reads data/projects.json + data/site.json and regenerates:
 *   - /work/<slug>/index.html          case-study pages
 *   - /work/index.html                 case-study hub
 *   - /services/<slug>/index.html      service landing pages
 *   - /industries/<slug>/index.html    industry landing pages
 *   - /thank-you/index.html            form success page (noindex)
 *   - /404.html                        not-found page
 *   - index.html blocks between <!-- NAME:START/END --> markers
 *     (JSONLD, PROJECTS, INDUSTRIES, FAQ, FOOTER)
 *   - sitemap.xml, llms.txt
 *
 * Netlify serves the committed output as-is. There is no build step on deploy,
 * so re-run this script and commit after editing either data file.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DOMAIN = "https://bx.media";
const ENTITY = "BX Media Automotive";
const ORG_ID = `${DOMAIN}/#org`;

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, s) => {
  const full = path.join(ROOT, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, s);
};

const projects = JSON.parse(read("data/projects.json")).projects;
const site = JSON.parse(read("data/site.json"));
const C = site.contact;
const serviceBySlug = Object.fromEntries(site.services.map((s) => [s.slug, s]));
const industryBySlug = Object.fromEntries(site.industries.map((s) => [s.slug, s]));

/* ---------- helpers ---------- */

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

function clip(s, n = 155) {
  s = noDash(s).trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 3).replace(/\s+\S*$/, "") + "...";
}

const abs = (p) => DOMAIN + "/" + String(p).replace(/^\/+/, "");
const absImg = (p) => abs(String(p).split("/").map(encodeURIComponent).join("/"));
const LOGO = absImg("assets/index/7 logo.png");

function waLink(text) {
  return `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(text)}`;
}

function gitLastmod(files) {
  let best = "";
  for (const f of [].concat(files)) {
    try {
      const iso = execSync(`git log -1 --format=%cI -- "${f}"`, { cwd: ROOT }).toString().trim();
      if (iso && iso.slice(0, 10) > best) best = iso.slice(0, 10);
    } catch (e) {
      /* not committed yet */
    }
  }
  return best || new Date().toISOString().slice(0, 10);
}

function jsonLd(graph) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);
  return `<script type="application/ld+json">\n${json.replace(/<\//g, "<\\/")}\n  </script>`;
}

function breadcrumb(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, item], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item,
    })),
  };
}

function faqPage(id, faqs) {
  return {
    "@type": "FAQPage",
    "@id": id,
    mainEntity: faqs.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

function videoId(src) {
  return src.includes("youtube") ? src.split("/embed/")[1] : src.split("/video/")[1].split("?")[0];
}

/* ---------- shared chrome ---------- */

function head({ title, description, canonical, image, ogType = "website", robots, extra = "", graph }) {
  const img = image || `${DOMAIN}/bxmedia-preview.jpg`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
${robots ? `  <meta name="robots" content="${robots}">\n` : ""}${canonical ? `  <link rel="canonical" href="${canonical}" />\n` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="/style.css" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" referrerpolicy="no-referrer" />
  <link rel="icon" href="/assets/index/favicon.ico" type="image/x-icon">
  <link rel="apple-touch-icon" href="/assets/index/apple-touch-icon.png">

  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
${canonical ? `  <meta property="og:url" content="${canonical}" />\n` : ""}  <meta property="og:image" content="${esc(img)}" />
  <meta property="og:site_name" content="${ENTITY}" />
  <meta property="og:locale" content="en_US" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(img)}" />
${extra}
${graph ? "  " + jsonLd(graph) + "\n" : ""}</head>`;
}

function nav() {
  const items = [
    ["Home", "/"],
    ["About", "/#about"],
    ["Services", "/#services"],
    ["Work", "/work/"],
    ["Contact", "/#contact"],
  ];
  return `  <div class="scroll-progress"><div class="progress-bar"></div></div>

  <nav class="navbar" data-animate="navbar">
    <div class="nav-container">
      <div class="nav-logo">
        <a href="/"><img src="/assets/index/7 logo.png" alt="BX Media Automotive logo" class="logo-img" /></a>
      </div>
      <ul class="nav-menu">
${items.map(([n, h], i) => `        <li class="nav-item" style="--index: ${i}"><a href="${h}">${n}</a></li>`).join("\n")}
      </ul>
      <div class="hamburger">
        <span></span><span></span><span></span>
      </div>
    </div>
  </nav>`;
}

function footerInner() {
  const svc = site.services.map((s) => `            <li><a href="/services/${s.slug}/">${esc(s.name)}</a></li>`).join("\n");
  const ind = site.industries.map((s) => `            <li><a href="/industries/${s.slug}/">${esc(s.name)}</a></li>`).join("\n");
  return `    <div class="container">
      <div class="footer-content">
        <div class="footer-section">
          <h3>BX Media</h3>
          <p>We don't just create content — we engineer experiences. At BX Media, every shot, story, and strategy is designed to amplify your brand, fuel engagement, and accelerate results.</p>
          <address class="footer-nap">
            ${ENTITY}<br />
            ${esc(C.city)}, ${esc(C.country)}<br />
            <a href="mailto:${C.email}">${C.email}</a><br />
            <a href="tel:${C.phone}">${C.phoneDisplay}</a>
          </address>
        </div>
        <div class="footer-section">
          <h4>Services</h4>
          <ul>
${svc}
          </ul>
        </div>
        <div class="footer-section">
          <h4>Industries</h4>
          <ul>
${ind}
          </ul>
        </div>
        <div class="footer-section">
          <h4>Quick Links</h4>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/#about">About</a></li>
            <li><a href="/work/">Work</a></li>
            <li><a href="/#contact">Contact</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="social-links centered">
          <a href="${C.instagram}" target="_blank" rel="noopener" aria-label="Follow BX Media on Instagram">
            <i class="fa-brands fa-instagram" aria-hidden="true"></i>
          </a>
          <a href="${C.linkedin}" target="_blank" rel="noopener" aria-label="Connect with BX Media on LinkedIn">
            <i class="fa-brands fa-linkedin" aria-hidden="true"></i>
          </a>
        </div>
        <p>&copy; 2026 BX Media. All rights reserved.</p>
      </div>
    </div>`;
}

function waFloat(text) {
  return `  <a class="whatsapp-float" href="${esc(waLink(text))}" target="_blank" rel="noopener" aria-label="Chat with BX Media on WhatsApp">
    <span class="whatsapp-icon" aria-hidden="true">
      <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
    </span>
  </a>`;
}

function page({ headHtml, body, waText, extraScripts = "" }) {
  return `${headHtml}
<body class="subpage">
${nav()}

  <main>
${body}
  </main>

${waFloat(waText)}

  <footer class="footer">
${footerInner()}
  </footer>

  <script src="/script.js"></script>
${extraScripts}</body>
</html>
`;
}

function crumbsHtml(items) {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items
    .map(([n, h], i) =>
      i === items.length - 1 ? `<li aria-current="page">${esc(n)}</li>` : `<li><a href="${h}">${esc(n)}</a></li>`
    )
    .join("")}</ol></nav>`;
}

function ctaBand({ heading, text, interest, waText }) {
  return `      <section class="cta-band">
        <h2>${esc(heading)}</h2>
        <p>${esc(text)}</p>
        <div class="cta-actions">
          <a class="cta-btn" href="/?interest=${encodeURIComponent(interest)}#contact"><span>Send a brief</span><i class="fas fa-arrow-right" aria-hidden="true"></i></a>
          <a class="cta-btn cta-btn--ghost" href="${esc(waLink(waText))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i><span>WhatsApp us</span></a>
        </div>
        <p class="cta-note">We reply within 24 hours with a tailored content roadmap.</p>
      </section>`;
}

function faqHtml(faqs, heading = "Frequently asked questions") {
  return `      <section class="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">${esc(heading)}</h2>
${faqs
  .map(
    ([q, a]) => `        <details class="faq-item">
          <summary>${esc(q)}</summary>
          <p>${esc(a)}</p>
        </details>`
  )
  .join("\n")}
      </section>`;
}

// Portfolio filter categories (client-facing labels in FILTERS below).
const FILTERS = [
  ["all", "All"],
  ["car-brands", "Car Brands"],
  ["car-care", "Car Care"],
  ["motorsport", "Motorsport & Events"],
  ["creators", "Creator Collabs"],
];
function projectCats(p) {
  const map = {
    "car-brands-and-dealerships": "car-brands",
    "detailing-and-service-centers": "car-care",
    "motorsport-and-events": "motorsport",
  };
  const cats = p.industries.map((i) => map[i]);
  if (p.services.includes("automotive-influencer-marketing")) cats.push("creators");
  return [...new Set(cats)];
}

const where = (p) => (p.location === "Saudi Arabia" ? p.location : `${p.location}, Saudi Arabia`);

function projectCard(p, i, prefix = "/") {
  return `        <div class="project-card reveal-on-scroll" data-cats="${projectCats(p).join(" ")}" style="--index: ${i}">
          <div class="project-image">
            <img src="${prefix}${esc(p.imageWeb)}" alt="${esc(p.gridTitle)}" loading="lazy" decoding="async" />
          </div>
          <div class="project-info">
            <h3>${esc(p.gridTitle)}</h3>
            <a href="/services/${p.services[0]}/" class="project-category">${esc(p.category)}</a>
            <div class="project-details">
              <p><strong>Client:</strong> ${esc(p.client)}</p>
              <p><strong>Location:</strong> ${esc(p.location)}</p>
            </div>
            <a href="/work/${p.slug}/" class="project-btn">View Project</a>
          </div>
        </div>`;
}

/* ---------- org-level schema ---------- */

function orgNode() {
  return {
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORG_ID,
    name: ENTITY,
    alternateName: ["BX Media", "BXM Auto"],
    description:
      "BX Media Automotive is a Riyadh-based automotive content and video production agency. It produces cinematic videos, social media content and influencer campaigns for car brands, dealerships, detailing and service centres, and motorsport organisers across Saudi Arabia and the GCC.",
    url: `${DOMAIN}/`,
    logo: { "@type": "ImageObject", url: LOGO },
    image: `${DOMAIN}/bxmedia-preview.jpg`,
    email: C.email,
    telephone: C.phone,
    address: {
      "@type": "PostalAddress",
      addressLocality: C.city,
      addressRegion: "Riyadh Province",
      addressCountry: "SA",
    },
    areaServed: site.areaServed.map((n) => ({ "@type": "Country", name: n })),
    knowsAbout: [
      "automotive video production",
      "car commercial production",
      "vehicle launch campaigns",
      "automotive social media management",
      "automotive influencer marketing",
      "motorsport event coverage",
      "car detailing content",
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: `+${C.whatsapp}`,
        url: `https://wa.me/${C.whatsapp}`,
        email: C.email,
        areaServed: site.areaServed,
      },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Automotive content services",
      itemListElement: site.services.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@id": `${DOMAIN}/services/${s.slug}/#service` },
      })),
    },
    sameAs: [C.instagram, C.linkedin],
  };
}

function serviceNode(s) {
  return {
    "@type": "Service",
    "@id": `${DOMAIN}/services/${s.slug}/#service`,
    name: s.name,
    serviceType: s.h1,
    description: noDash(s.answer),
    url: `${DOMAIN}/services/${s.slug}/`,
    provider: { "@id": ORG_ID },
    areaServed: site.areaServed.map((n) => ({ "@type": "Country", name: n })),
    audience: { "@type": "BusinessAudience", audienceType: "Automotive brands, dealerships, service centres and motorsport organisers" },
  };
}

/* ---------- work pages ---------- */

const detailSrc = read("project-details.html");
const styleBlock = (detailSrc.match(/<style>[\s\S]*?<\/style>/) || ["<style></style>"])[0]
  // generated pages carry a navbar + breadcrumbs instead of the old back link
  .replace(/margin: 120px auto 60px;/, "margin: 0 auto 60px;");

// Player URL for on-page embeds: hide Vimeo's raw file title, byline and avatar.
function playerSrc(v) {
  if (!v.src.includes("vimeo")) return v.src;
  return v.src + (v.src.includes("?") ? "&" : "?") + "title=0&byline=0&portrait=0&badge=0&dnt=1";
}

function videoName(p, v) {
  return v.name || `${p.detailTitle}: ${v.title}`;
}

function videoObject(p, v) {
  const vo = {
    "@type": "VideoObject",
    name: videoName(p, v),
    description: noDash(
      `${v.title}. Produced by ${ENTITY} for ${p.client}${p.location ? " in " + p.location : ""}. ${p.summary}`
    ),
    thumbnailUrl: v.thumbnail,
    uploadDate: v.uploadDate,
    duration: v.duration,
    embedUrl: v.src,
    creator: { "@id": ORG_ID },
  };
  if (v.watchUrl) vo.url = v.watchUrl;
  if (v.nameAr) vo.alternateName = v.nameAr;
  if (v.inLanguage) vo.inLanguage = v.inLanguage;
  return vo;
}

function iframe(p, v) {
  return (
    `<iframe src="${esc(playerSrc(v))}" allow="autoplay; fullscreen; picture-in-picture" ` +
    `allowfullscreen loading="lazy" title="${esc(videoName(p, v))}"></iframe>`
  );
}

function buildGallery(p) {
  const first = p.videos[0];
  const firstTall = first.aspect === "portrait" ? " tall" : first.aspect === "cinema" ? " cinema" : "";
  const thumbs =
    p.videos.length < 2
      ? ""
      : `        <div class="video-thumbs" aria-label="More videos">\n` +
        p.videos
          .map((v, i) => {
            const tall = v.aspect === "portrait" ? " tall" : "";
            const active = i === 0 ? " is-active" : "";
            return (
              `          <button class="video-thumb${tall}${active}" data-index="${i}" ` +
              `aria-label="Play: ${esc(v.title)}" style="--index: ${i}">` +
              `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" decoding="async" />` +
              `<span class="video-thumb-title">${esc(v.title)}</span></button>`
            );
          })
          .join("\n") +
        `\n        </div>`;

  return `      <div class="video-gallery">
        <h2 class="video-now-playing">${esc(first.title)}</h2>
        <div class="video-main">
          <div class="video-wrapper${firstTall}">
            ${iframe(p, first)}
          </div>
        </div>
${thumbs}
      </div>`;
}

function galleryScript(p) {
  if (p.videos.length < 2) return "";
  const mini = p.videos.map((v) => ({ t: v.title, n: videoName(p, v), s: playerSrc(v), a: v.aspect }));
  return `  <script>
(function () {
  var videos = ${JSON.stringify(mini)};
  var gallery = document.querySelector('.video-gallery');
  if (!gallery) return;
  var main = gallery.querySelector('.video-main');
  var titleEl = gallery.querySelector('.video-now-playing');
  var thumbs = gallery.querySelector('.video-thumbs');
  if (!main || !thumbs) return;
  var current = 0;
  function render(i) {
    var v = videos[i];
    if (!v || i === current) return;
    current = i;
    var tall = v.a === 'portrait' ? ' tall' : v.a === 'cinema' ? ' cinema' : '';
    if (titleEl) titleEl.textContent = v.t;
    main.innerHTML = '<div class="video-wrapper' + tall + '"><iframe src="' + v.s +
      '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" title="' +
      v.n.replace(/"/g, '&quot;') + '"></iframe></div>';
    thumbs.querySelectorAll('.video-thumb').forEach(function (b) {
      b.classList.toggle('is-active', Number(b.dataset.index) === i);
    });
    main.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  thumbs.querySelectorAll('.video-thumb').forEach(function (btn) {
    btn.addEventListener('click', function () { render(Number(btn.dataset.index)); });
  });
})();
  </script>
`;
}

function relatedProjects(p, n = 3) {
  const score = (o) =>
    o.industries.filter((x) => p.industries.includes(x)).length * 2 +
    o.services.filter((x) => p.services.includes(x)).length;
  return projects
    .filter((o) => o.slug !== p.slug)
    .map((o, i) => ({ o, s: score(o), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .map((x) => x.o);
}

function buildWorkPage(p) {
  const url = `${DOMAIN}/work/${p.slug}/`;
  const title = `${p.detailTitle}: Car Video Case Study | BX Media`;
  const meta = clip(p.summary);
  const img = absImg(p.image);

  const work = {
    "@type": "CreativeWork",
    "@id": url + "#work",
    name: p.detailTitle,
    headline: `${p.detailTitle}: automotive video production case study`,
    abstract: noDash(p.summary),
    description: noDash(p.description),
    url,
    image: img,
    creator: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    locationCreated: { "@type": "Place", name: where(p) },
    about: { "@type": "Organization", name: p.client },
    genre: p.services.map((s) => serviceBySlug[s].name),
    keywords: [].concat(p.deliverables, p.services.map((s) => serviceBySlug[s].h1)).join(", "),
    video: p.videos.map((v) => videoObject(p, v)),
  };
  if (p.year) work.temporalCoverage = p.year.replace("–", "/");
  const crumbs = [
    ["Home", `${DOMAIN}/`],
    ["Work", `${DOMAIN}/work/`],
    [p.detailTitle, url],
  ];

  const facts = [
    ["Client", esc(p.client)],
    ["Location", esc(where(p))],
    p.year ? ["Year", esc(p.year)] : null,
    ["Services", p.services.map((s) => `<a href="/services/${s}/">${esc(serviceBySlug[s].name)}</a>`).join(", ")],
    ["Industry", p.industries.map((s) => `<a href="/industries/${s}/">${esc(industryBySlug[s].name)}</a>`).join(", ")],
    ["Deliverables", esc(p.deliverables.join("; "))],
    p.results ? ["Results", esc(p.results)] : null,
  ].filter(Boolean);

  const waText = `Hi BX Media, I saw your ${p.detailTitle} project and want something similar. (bx.media/work/${p.slug}/)`;
  const related = relatedProjects(p);

  const body = `    <div class="container">
      ${crumbsHtml([["Home", "/"], ["Work", "/work/"], [p.detailTitle]])}
      <section id="projectDetails" class="project-detail-container">
        <h1>${esc(p.detailTitle)}</h1>
        <p>${esc(p.description)}</p>
${buildGallery(p)}
      </section>

      <section class="project-facts" aria-label="Project facts">
        <h2>Project details</h2>
        <dl>
${facts.map(([k, v]) => `          <div><dt>${k}</dt><dd>${v}</dd></div>`).join("\n")}
        </dl>
      </section>

${ctaBand({
  heading: "Planning something similar?",
  text: `Tell us about your model, launch or brand. We'll plan a production like ${p.detailTitle} around your goals.`,
  interest: serviceBySlug[p.services[0]].interest,
  waText,
})}

      <section class="related-work">
        <h2>More automotive work</h2>
        <div class="projects-grid">
${related.map((o, i) => projectCard(o, i)).join("\n")}
        </div>
      </section>
    </div>`;

  return page({
    headHtml: head({
      title,
      description: meta,
      canonical: url,
      image: img,
      ogType: "article",
      extra: "  " + styleBlock,
      graph: [work, breadcrumb(crumbs)],
    }),
    body,
    waText,
    extraScripts: galleryScript(p),
  });
}

/* ---------- work hub ---------- */

function durationLabel(iso) {
  const m = /PT(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "") || [];
  const min = Number(m[1] || 0), sec = Number(m[2] || 0);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/* ---------- showreel ---------- */

const REEL = site.showreel;

function showreelButton(cls = "cta-btn cta-btn--ghost") {
  return `<button type="button" class="${cls} showreel-btn" data-film data-src="${esc(playerSrc(REEL))}" data-aspect="${REEL.aspect}" data-title="${esc(REEL.title)}" data-project="BX Media Automotive"><i class="fas fa-play" aria-hidden="true"></i><span>Watch Showreel</span></button>`;
}

function showreelNode() {
  return {
    "@type": "VideoObject",
    "@id": `${DOMAIN}/#showreel`,
    name: REEL.title,
    description: noDash(REEL.description),
    thumbnailUrl: REEL.thumbnail,
    uploadDate: REEL.uploadDate,
    duration: REEL.duration,
    embedUrl: REEL.src,
    creator: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
}

function filterBar() {
  return `      <div class="work-filters" role="group" aria-label="Filter work">
${FILTERS.map(([k, n], i) => `        <button type="button" class="work-filter${i === 0 ? " is-active" : ""}" data-filter="${k}" aria-pressed="${i === 0}">${esc(n)}</button>`).join("\n")}
      </div>`;
}

function filmLibrary() {
  const tiles = [
    `          <button type="button" class="film-tile film-tile--reel" data-cats="showreel" data-film data-src="${esc(playerSrc(REEL))}" data-aspect="${REEL.aspect}" data-title="${esc(REEL.title)}" data-project="BX Media Automotive">
            <img src="${esc(REEL.thumbnail)}" alt="" loading="lazy" decoding="async" />
            <span class="film-play" aria-hidden="true"><i class="fas fa-play"></i></span>
            <span class="film-duration">${durationLabel(REEL.duration)}</span>
            <span class="film-meta"><strong>Showreel 2025</strong><span>BX Media</span></span>
          </button>`,
  ];
  projects.forEach((p) => {
    p.videos.forEach((v) => {
      tiles.push(`          <button type="button" class="film-tile${v.aspect === "portrait" ? " film-tile--tall" : ""}" data-cats="${projectCats(p).join(" ")}" ${filmData(p, v)}>
            <img src="${esc(v.thumbnail)}" alt="" loading="lazy" decoding="async" />
            <span class="film-play" aria-hidden="true"><i class="fas fa-play"></i></span>
            <span class="film-duration">${durationLabel(v.duration)}</span>
            <span class="film-meta"><strong>${esc(v.title)}</strong><span>${esc(p.gridTitle)}</span></span>
          </button>`);
    });
  });
  return `      <section class="film-library" aria-labelledby="films-heading">
        <div class="film-library-head">
          <h2 id="films-heading">Film Library</h2>
          <p>Every film in one place. Tap any film to play it.</p>
        </div>
        <div class="film-wall">
${tiles.join("\n")}
        </div>
      </section>`;
}

function lightboxHtml() {
  return `
      <dialog class="film-lightbox" aria-label="Video player">
        <div class="film-lightbox-inner">
          <button type="button" class="film-close" aria-label="Close video"><i class="fas fa-xmark" aria-hidden="true"></i></button>
          <div class="film-frame"></div>
          <div class="film-lightbox-meta">
            <div><strong class="film-lightbox-title"></strong><span class="film-lightbox-project"></span></div>
            <a class="film-lightbox-link" href="#">View project <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
          </div>
        </div>
      </dialog>`;
}

// Opens any element carrying data-src / data-aspect / data-title / data-project / data-url
// (film tiles) in the shared lightbox.
function lightboxScript() {
  return `  <script>
(function () {
  var box = document.querySelector('.film-lightbox');
  if (!box || typeof box.showModal !== 'function') return;
  var frame = box.querySelector('.film-frame');
  function close() {
    frame.innerHTML = '';
    if (box.open) box.close();
  }
  document.querySelectorAll('[data-film]').forEach(function (el) {
    el.addEventListener('click', function () {
      var src = el.dataset.src;
      src += (src.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1';
      var a = el.dataset.aspect;
      frame.className = 'film-frame' + (a === 'portrait' ? ' film-frame--tall' : a === 'cinema' ? ' film-frame--cinema' : '');
      frame.innerHTML = '<iframe src="' + src + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="' +
        el.dataset.title.replace(/"/g, '&quot;') + '"></iframe>';
      box.querySelector('.film-lightbox-title').textContent = el.dataset.title;
      box.querySelector('.film-lightbox-project').textContent = el.dataset.project;
      var link = box.querySelector('.film-lightbox-link');
      link.hidden = !el.dataset.url;
      if (el.dataset.url) link.href = el.dataset.url;
      box.showModal();
    });
  });
  box.querySelector('.film-close').addEventListener('click', close);
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  box.addEventListener('close', function () { frame.innerHTML = ''; });
})();
  </script>
`;
}

function filmData(p, v) {
  return `data-film data-src="${esc(playerSrc(v))}" data-aspect="${v.aspect}" data-title="${esc(v.title)}" data-project="${esc(p.detailTitle)}" data-url="/work/${p.slug}/"`;
}

function workHubScript() {
  return `  <script>
(function () {
  var buttons = document.querySelectorAll('.work-filter');
  var items = document.querySelectorAll('.work-hub [data-cats]');
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.dataset.filter;
      buttons.forEach(function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on);
      });
      items.forEach(function (el) {
        var show = f === 'all' || el.dataset.cats.split(' ').indexOf(f) !== -1;
        el.hidden = !show;
      });
    });
  });

})();
  </script>
`;
}

function buildWorkIndex() {
  const url = `${DOMAIN}/work/`;
  const desc = "Launch films, creator collaborations, motorsport series and car care showcases by BX Media Automotive for car brands and automotive businesses in Saudi Arabia.";
  const graph = [
    {
      "@type": "CollectionPage",
      "@id": url + "#page",
      name: "Automotive Video Production Portfolio",
      description: desc,
      url,
      isPartOf: { "@id": `${DOMAIN}/#website` },
      about: { "@id": ORG_ID },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: projects.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${DOMAIN}/work/${p.slug}/`,
          name: p.detailTitle,
          description: noDash(p.summary),
        })),
      },
    },
    breadcrumb([["Home", `${DOMAIN}/`], ["Work", url]]),
    showreelNode(),
  ];
  const waText = "Hi BX Media, I'd like to discuss a project. (bx.media/work/)";
  const body = `    <div class="container">
      ${crumbsHtml([["Home", "/"], ["Work"]])}
      <header class="page-hero">
        <p class="eyebrow">Our Work</p>
        <h1>Automotive Films That Move</h1>
        <p class="lead">Launch films, creator collaborations, motorsport series and car care showcases for the brands driving Saudi Arabia's automotive scene.</p>
        <div class="cta-actions">
          ${showreelButton("cta-btn")}
        </div>
      </header>
    </div>
    <div class="container page-shell work-hub">
${filterBar()}
      <section aria-labelledby="cases-heading">
        <h2 id="cases-heading" class="work-section-title">Projects</h2>
        <div class="projects-grid">
${projects.map((p, i) => projectCard(p, i)).join("\n")}
        </div>
      </section>
${filmLibrary()}
${lightboxHtml()}
${ctaBand({ heading: "Want your brand on this wall?", text: "Share your goals and we'll plan the right production for your brand.", interest: "launch", waText })}
    </div>`;
  return page({
    headHtml: head({
      title: `Automotive Video Production Portfolio | ${ENTITY}`,
      description: desc,
      canonical: url,
      graph,
    }),
    body,
    waText,
    extraScripts: workHubScript() + lightboxScript(),
  });
}

/* ---------- service + industry landing pages ---------- */

function projectsFor(pred) {
  return projects.filter(pred);
}

function buildServicePage(s) {
  const url = `${DOMAIN}/services/${s.slug}/`;
  const work = projectsFor((p) => p.services.includes(s.slug));
  const waText = `Hi BX Media, I'm interested in ${s.name}. (bx.media/services/${s.slug}/)`;
  const graph = [
    serviceNode(s),
    {
      "@type": "WebPage",
      "@id": url + "#page",
      url,
      name: s.title,
      description: s.metaDescription,
      isPartOf: { "@id": `${DOMAIN}/#website` },
      mainEntity: { "@id": url + "#service" },
    },
    breadcrumb([["Home", `${DOMAIN}/`], ["Services", `${DOMAIN}/#services`], [s.name, url]]),
    faqPage(url + "#faq", s.faqs),
  ];
  const otherServices = site.services.filter((o) => o.slug !== s.slug);

  const body = `    <div class="container page-shell">
      ${crumbsHtml([["Home", "/"], ["Services", "/#services"], [s.name]])}
      <header class="page-hero">
        <p class="eyebrow">${esc(s.name)}</p>
        <h1>${esc(s.h1)}</h1>
        <p class="lead">${esc(s.intro)}</p>
        <div class="cta-actions">
          <a class="cta-btn" href="/?interest=${s.interest}#contact"><span>Send a brief</span><i class="fas fa-arrow-right" aria-hidden="true"></i></a>
          <a class="cta-btn cta-btn--ghost" href="${esc(waLink(waText))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i><span>WhatsApp us</span></a>
        </div>
      </header>

      <section class="feature-section">
        <h2>What's included</h2>
        <div class="feature-grid">
${s.includes.map(([h, t]) => `          <div class="feature-card"><h3>${esc(h)}</h3><p>${esc(t)}</p></div>`).join("\n")}
        </div>
      </section>

      <section class="feature-section">
        <h2>How it works</h2>
        <ol class="steps">
${s.process.map(([h, t]) => `          <li><h3>${esc(h)}</h3><p>${esc(t)}</p></li>`).join("\n")}
        </ol>
      </section>

      <section class="feature-section">
        <h2>Who it's for</h2>
        <div class="feature-grid">
${site.industries.map((i) => `          <a class="feature-card feature-card--link" href="/industries/${i.slug}/"><h3>${esc(i.name)}</h3><p>${esc(i.cardText)}</p></a>`).join("\n")}
        </div>
      </section>

${work.length ? `      <section class="related-work">
        <h2>${esc(s.name)}: selected work</h2>
        <div class="projects-grid">
${work.map((p, i) => projectCard(p, i)).join("\n")}
        </div>
      </section>
` : ""}
${faqHtml(s.faqs)}

      <section class="feature-section">
        <h2>Other services</h2>
        <div class="feature-grid">
${otherServices.map((o) => `          <a class="feature-card feature-card--link" href="/services/${o.slug}/"><h3>${esc(o.name)}</h3><p>${esc(o.cardText)}</p></a>`).join("\n")}
        </div>
      </section>

${ctaBand({ heading: `Start your ${s.name.toLowerCase()} project`, text: "Share a few details and our producers will respond within 24 hours.", interest: s.interest, waText })}
    </div>`;

  return page({
    headHtml: head({ title: `${s.title} | BX Media`, description: s.metaDescription, canonical: url, graph }),
    body,
    waText,
  });
}

function buildIndustryPage(ind) {
  const url = `${DOMAIN}/industries/${ind.slug}/`;
  const work = projectsFor((p) => p.industries.includes(ind.slug));
  const waText = `Hi BX Media, I'm reaching out about content for ${ind.name}. (bx.media/industries/${ind.slug}/)`;
  const graph = [
    {
      "@type": "WebPage",
      "@id": url + "#page",
      url,
      name: ind.title,
      description: ind.metaDescription,
      isPartOf: { "@id": `${DOMAIN}/#website` },
      about: { "@id": ORG_ID },
      audience: { "@type": "BusinessAudience", audienceType: ind.name },
      mentions: work.map((p) => ({ "@id": `${DOMAIN}/work/${p.slug}/#work` })),
    },
    breadcrumb([["Home", `${DOMAIN}/`], ["Industries", `${DOMAIN}/#industries`], [ind.name, url]]),
  ];
  const body = `    <div class="container page-shell">
      ${crumbsHtml([["Home", "/"], ["Industries", "/#industries"], [ind.name]])}
      <header class="page-hero">
        <p class="eyebrow">${esc(ind.name)}</p>
        <h1>${esc(ind.h1)}</h1>
        <p class="lead">${esc(ind.intro)}</p>
        <div class="cta-actions">
          <a class="cta-btn" href="/?interest=${ind.interest}#contact"><span>Send a brief</span><i class="fas fa-arrow-right" aria-hidden="true"></i></a>
          <a class="cta-btn cta-btn--ghost" href="${esc(waLink(waText))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i><span>WhatsApp us</span></a>
        </div>
      </header>

      <section class="feature-section">
        <h2>What we make for you</h2>
        <div class="feature-grid">
${ind.points.map(([h, t]) => `          <div class="feature-card"><h3>${esc(h)}</h3><p>${esc(t)}</p></div>`).join("\n")}
        </div>
        <p class="client-note">${esc(ind.clientNote)}</p>
      </section>

${work.length ? `      <section class="related-work">
        <h2>Case studies</h2>
        <div class="projects-grid">
${work.map((p, i) => projectCard(p, i)).join("\n")}
        </div>
      </section>
` : ""}
      <section class="feature-section">
        <h2>Services</h2>
        <div class="feature-grid">
${site.services.map((o) => `          <a class="feature-card feature-card--link" href="/services/${o.slug}/"><h3>${esc(o.name)}</h3><p>${esc(o.cardText)}</p></a>`).join("\n")}
        </div>
      </section>

${ctaBand({ heading: "Let's plan your next campaign", text: "Share a few details and our producers will respond within 24 hours.", interest: ind.interest, waText })}
    </div>`;

  return page({
    headHtml: head({ title: `${ind.title} | BX Media`, description: ind.metaDescription, canonical: url, graph }),
    body,
    waText,
  });
}

/* ---------- utility pages ---------- */

function buildThankYou() {
  const waText = "Hi BX Media, I just submitted a brief on bx.media.";
  const body = `    <div class="container page-shell">
      <header class="page-hero page-hero--center">
        <p class="eyebrow">Brief received</p>
        <h1>Thank you. Your brief is on its way to our producers.</h1>
        <p class="lead">We'll reply within 24 hours with a tailored content roadmap. Need a faster answer? Message us on WhatsApp.</p>
        <div class="cta-actions">
          <a class="cta-btn" href="${esc(waLink(waText))}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i><span>WhatsApp ${C.whatsappDisplay}</span></a>
          <a class="cta-btn cta-btn--ghost" href="/work/"><span>Browse our work</span></a>
        </div>
      </header>
    </div>`;
  return page({
    headHtml: head({ title: `Thank you | ${ENTITY}`, description: "Your brief has been received.", robots: "noindex, follow" }),
    body,
    waText,
  });
}

function build404() {
  const waText = "Hi BX Media, I'd like to discuss a project.";
  const body = `    <div class="container page-shell">
      <header class="page-hero page-hero--center">
        <p class="eyebrow">404</p>
        <h1>This page took a wrong turn.</h1>
        <p class="lead">The page you're looking for doesn't exist. Try one of these instead.</p>
        <div class="cta-actions">
          <a class="cta-btn" href="/"><span>Home</span></a>
          <a class="cta-btn cta-btn--ghost" href="/work/"><span>Our work</span></a>
          <a class="cta-btn cta-btn--ghost" href="/#contact"><span>Contact</span></a>
        </div>
      </header>
    </div>`;
  return page({
    headHtml: head({ title: `Page not found | ${ENTITY}`, description: "Page not found.", robots: "noindex, follow" }),
    body,
    waText,
  });
}

/* ---------- homepage blocks ---------- */

function homeGraph() {
  return [
    orgNode(),
    {
      "@type": "WebSite",
      "@id": `${DOMAIN}/#website`,
      name: ENTITY,
      alternateName: "BX Media",
      url: `${DOMAIN}/`,
      inLanguage: "en",
      publisher: { "@id": ORG_ID },
    },
    {
      "@type": "WebPage",
      "@id": `${DOMAIN}/#webpage`,
      url: `${DOMAIN}/`,
      name: "BX Media | Automotive Video Production & Content Agency in Riyadh",
      isPartOf: { "@id": `${DOMAIN}/#website` },
      about: { "@id": ORG_ID },
      primaryImageOfPage: `${DOMAIN}/bxmedia-preview.jpg`,
    },
    ...site.services.map(serviceNode),
    faqPage(`${DOMAIN}/#faq`, site.faqs),
    showreelNode(),
  ];
}

function industriesSection() {
  return `  <section id="industries" class="services industries fade-in">
    <div class="container">
      <div class="section-header">
        <h4>Who We Work With</h4>
        <h2>Built for Every Corner of the Automotive Industry</h2>
      </div>
      <div class="services-grid" role="list">
${site.industries
  .map(
    (ind, i) => `        <a class="service-card service-card--link" role="listitem" style="--index: ${i}" href="/industries/${ind.slug}/">
          <h3>${esc(ind.name)}</h3>
          <p>${esc(ind.cardText)}</p>
          <span class="card-link">Learn more <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
        </a>`
  )
  .join("\n")}
      </div>
    </div>
  </section>`;
}

function homeFaqSection() {
  return `  <section id="faq" class="home-faq fade-in">
    <div class="container">
      <div class="section-header">
        <h4>FAQ</h4>
        <h2>Questions Brands Ask Us</h2>
      </div>
${faqHtml(site.faqs, "Frequently asked questions").replace('<h2 id="faq-heading">Frequently asked questions</h2>', '<h2 id="faq-heading" class="visually-hidden">Frequently asked questions</h2>')}
    </div>
  </section>`;
}

function injectBlock(html, name, content) {
  const re = new RegExp(`<!-- ${name}:START -->[\\s\\S]*?<!-- ${name}:END -->`);
  if (!re.test(html)) throw new Error(`${name} markers not found in index.html`);
  return html.replace(re, () => `<!-- ${name}:START -->\n${content}\n  <!-- ${name}:END -->`);
}

function buildHome() {
  let html = read("index.html");
  html = injectBlock(html, "JSONLD", "  " + jsonLd(homeGraph()));
  html = injectBlock(html, "PROJECTS", projects.filter((p) => p.featured).map((p, i) => projectCard(p, i, "")).join("\n"));
  html = injectBlock(html, "INDUSTRIES", industriesSection());
  html = injectBlock(html, "FAQ", homeFaqSection());
  html = injectBlock(html, "FOOTER", footerInner());
  html = injectBlock(html, "SHOWREEL-BUTTON", "          " + showreelButton());
  html = injectBlock(html, "LIGHTBOX", lightboxHtml() + "\n" + lightboxScript());
  write("index.html", html);
}

/* ---------- sitemap + llms.txt ---------- */

function buildSitemap() {
  const dataMod = gitLastmod(["data/projects.json", "data/site.json", "tools/build-site.js"]);
  const urls = [
    { loc: `${DOMAIN}/`, lastmod: gitLastmod(["index.html", "data/site.json"]) },
    { loc: `${DOMAIN}/work/`, lastmod: dataMod },
    ...site.services.map((s) => ({ loc: `${DOMAIN}/services/${s.slug}/`, lastmod: dataMod })),
    ...site.industries.map((s) => ({ loc: `${DOMAIN}/industries/${s.slug}/`, lastmod: dataMod })),
    ...projects.map((p) => ({ loc: `${DOMAIN}/work/${p.slug}/`, lastmod: dataMod })),
  ];
  const body = urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildLlms() {
  return `# ${ENTITY}

> ${ENTITY} (also known as BX Media) is an automotive content and video production agency based in Riyadh, Saudi Arabia. It produces cinematic videos, social media content and influencer campaigns for car brands, dealerships, detailing and service centres, and motorsport organisers across Saudi Arabia and the GCC.

Key facts:
- Headquarters: ${C.city}, ${C.country}. Serves: ${site.areaServed.join(", ")}.
- Specialisation: the automotive industry.
- Notable result: nine long-form YouTube episodes produced with ArabGT covering SAMF motorsport championships, with over 1M organic views.
- New enquiries: a reply within 24 hours with a tailored content roadmap.

## Services
${site.services.map((s) => `- [${s.h1}](${DOMAIN}/services/${s.slug}/): ${noDash(s.answer)}`).join("\n")}

## Industries
${site.industries.map((s) => `- [${s.name}](${DOMAIN}/industries/${s.slug}/): ${noDash(s.answer)}`).join("\n")}

## Case studies
- [Portfolio overview](${DOMAIN}/work/)
${projects.map((p) => `- [${p.detailTitle}](${DOMAIN}/work/${p.slug}/): ${noDash(p.summary)}`).join("\n")}

## Clients
${site.clients.join(", ")}.

## FAQ
${site.faqs.map(([q, a]) => `- ${q} ${noDash(a)}`).join("\n")}

## Contact
- Email: ${C.email}
- Phone: ${C.phone}
- WhatsApp: https://wa.me/${C.whatsapp}
- Brief form: ${DOMAIN}/#contact
- Instagram: ${C.instagram}
- LinkedIn: ${C.linkedin}
`;
}

/* ---------- run ---------- */

projects.forEach((p) => write(`work/${p.slug}/index.html`, buildWorkPage(p)));
write("work/index.html", buildWorkIndex());
site.services.forEach((s) => write(`services/${s.slug}/index.html`, buildServicePage(s)));
site.industries.forEach((s) => write(`industries/${s.slug}/index.html`, buildIndustryPage(s)));
write("thank-you/index.html", buildThankYou());
write("404.html", build404());
buildHome();
write("sitemap.xml", buildSitemap());
write("llms.txt", buildLlms());

console.log(
  `Generated ${projects.length} work pages, work hub, ${site.services.length} service pages, ` +
    `${site.industries.length} industry pages, thank-you, 404, index.html blocks, sitemap.xml, llms.txt.`
);
