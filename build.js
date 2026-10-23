// Inlines styles, data, app code and map geometry into one self-contained page.
const fs = require("fs");
const read = p => fs.readFileSync(__dirname + "/" + p, "utf8");
// Crawlable pages for search engines and sharing: states, candidates, About, sitemap.
// Built first because it gives each candidate a readable page address the map links to.
const { build: buildPages } = require("./src/pages.js");
const data = JSON.parse(read("data/ballot.json"));
const pages = buildPages({ root: __dirname, data, styles: read("src/styles.css") });
const topo = JSON.stringify(JSON.parse(read("vendor/counties-albers-10m.json")));
let html = read("src/index.html");
html = html.replace("/*STYLES*/", () => read("src/styles.css"))
  .replace("/*TOPO*/", () => topo)
  .replace("/*DATA*/", () => "window.BALLOT_DATA = " + JSON.stringify(data).replace(/</g, "\\u003c") + ";")
  .replace("/*APP*/", () => read("src/app.js"));
fs.mkdirSync(__dirname + "/dist", { recursive: true });
fs.writeFileSync(__dirname + "/dist/ballot-atlas.html", html);
const site = pages.site;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const description = "See what's on your 2026 ballot: election dates, every race, and neutral, sourced profiles of each candidate, updated daily.";
// Plain links under the map so crawlers (and people without JavaScript) can reach every state page.
const footer = `<footer class="site-footer"><nav aria-label="States"><strong>Ballots by state:</strong> ${pages.states.map(s => `<a href="states/${s.slug}/">${esc(s.name)}</a>`).join(" · ")} · <a href="states/">All states</a> · <a href="about/">How this works</a> · <a href="privacy/">Privacy</a></nav>${pages.signup.replace('<section class="signup">', '<section class="signup site-signup">')}</footer>`;

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
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "Ballot Atlas", url: site + "/", description })}</script>
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${html}
${footer}
</body>
</html>
`;
fs.writeFileSync(__dirname + "/dist/index.html", page);
console.log("wrote dist/ballot-atlas.html and dist/index.html", (html.length / 1024).toFixed(0) + " KB,", pages.pages, "indexable pages for", site);
