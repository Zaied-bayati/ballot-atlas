// Inlines styles, data, app code and map geometry into one self-contained page.
const fs = require("fs");
const read = p => fs.readFileSync(__dirname + "/" + p, "utf8");
// Crawlable pages for search engines and sharing: states, candidates, About, sitemap.
// Built first because it gives each candidate a readable page address the map links to.
const { build: buildPages } = require("./src/pages.js");
const data = JSON.parse(read("data/ballot.json"));
const pages = buildPages({ root: __dirname, data, styles: read("src/styles.css") });
// Unprojected (longitude/latitude) geometry, so the app can draw it on a rotating globe.
const topo = JSON.stringify(JSON.parse(read("vendor/counties-10m.json")));
const land = JSON.stringify(JSON.parse(read("vendor/land-110m.json")));
let html = read("src/index.html");
html = html.replace("/*STYLES*/", () => read("src/styles.css"))
  .replace("/*TOPO*/", () => topo)
  .replace("/*LAND*/", () => land)
  .replace("/*DATA*/", () => "window.BALLOT_DATA = " + JSON.stringify(data).replace(/</g, "\\u003c") + ";")
  .replace("/*APP*/", () => read("src/app.js"));
fs.mkdirSync(__dirname + "/dist", { recursive: true });
fs.writeFileSync(__dirname + "/dist/ballot-atlas.html", html);
const site = pages.site;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const description = "See what's on your 2026 ballot: election dates, every race, and neutral, sourced profiles of each candidate, updated daily.";
// Plain links under the map so crawlers (and people without JavaScript) can reach every state page.
const footer = `<footer class="site-footer"><nav aria-label="States"><strong>Ballots by state:</strong> ${pages.states.map(s => `<a href="states/${s.slug}/">${esc(s.name)}</a>`).join(" · ")} · <a href="states/">All states</a> · <a href="about/">How this works</a> · <a href="privacy/">Privacy</a></nav>${pages.signup.replace('<section class="signup">', '<section class="signup site-signup">')}</footer>`;

// Ballot-box mark, used as the favicon (it shows next to the site in search results) and the logo.
fs.writeFileSync(__dirname + "/dist/favicon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#13362a"/><rect x="14" y="30" width="36" height="22" rx="3" fill="#fff"/><rect x="22" y="28" width="20" height="4" rx="2" fill="#13362a"/><path d="M26 12h12v18H26z" fill="#d9c592"/><path d="M29 20l2.5 2.5L36 18" stroke="#13362a" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>\n`);

// Standalone page for GitHub Pages: the same content inside a full HTML document.
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${description}">
<link rel="canonical" href="${site}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ballot Atlas">
<meta property="og:title" content="Ballot Atlas: see what's on your 2026 ballot">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${site}/">
<meta name="twitter:card" content="summary">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": [
  { "@type": "WebSite", "@id": site + "/#website", name: "Ballot Atlas", alternateName: ["BallotAtlas", "ballotatlas.org"], url: site + "/", description, publisher: { "@id": site + "/#org" } },
  // Add the site's social profile URLs to sameAs as they're created; it helps search engines tie them to the name.
  { "@type": "Organization", "@id": site + "/#org", name: "Ballot Atlas", url: site + "/", logo: site + "/favicon.svg", description: "A nonpartisan, sourced guide to what's on the 2026 ballot in each state.", sameAs: JSON.parse(fs.readFileSync(__dirname + "/data/site.json", "utf8")).sameAs || [] }
] })}</script>
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif;background:#efede7}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${html}
${footer}
</body>
</html>
`;
fs.writeFileSync(__dirname + "/dist/index.html", page);
console.log("wrote dist/ballot-atlas.html and dist/index.html", (html.length / 1024).toFixed(0) + " KB,", pages.pages, "indexable pages for", site);
