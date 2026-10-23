// Static, crawlable pages: one per state, one per candidate, an About page, sitemap and robots.txt.
// The map stays the front door; these are what search engines index and what people share.
const fs = require("fs");
const path = require("path");

const LEVELS = [["federal", "Federal"], ["state", "State"], ["courts", "State courts"], ["county", "County"]];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fmt = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const lastName = n => n.split(/\s+/).slice(-1)[0];
const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)) + "…");

function pageCss(styles) {
  // Reuse the app's color and font tokens so the pages match the map.
  const tokens = styles.slice(0, styles.indexOf("* { box-sizing"));
  return tokens + `
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--ink); }
body { font-family: var(--font-body); font-size: 16px; line-height: 1.6; }
a { color: var(--accent); }
h1, h2, h3 { font-family: var(--font-display); line-height: 1.2; text-wrap: balance; }
h1 { font-size: clamp(28px, 5vw, 40px); margin: 8px 0 12px; }
h2 { font-size: 22px; margin: 36px 0 12px; }
h3 { font-size: 18px; margin: 0 0 4px; }
.top { background: var(--surface); border-bottom: 1px solid var(--line); }
.top div, main, footer div { max-width: 820px; margin: 0 auto; padding: 0 16px; }
.top div { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 56px; flex-wrap: wrap; }
.brand { font-family: var(--font-display); font-weight: 700; font-size: 20px; color: var(--ink); text-decoration: none; }
.top nav a { margin-left: 16px; font-size: 14px; }
main { padding-top: 24px; padding-bottom: 48px; }
.crumbs { font-size: 14px; color: var(--muted); }
.lede { color: var(--muted); font-size: 18px; margin: 0 0 8px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin: 0 0 12px; }
.card p { margin: 4px 0 0; }
.muted { color: var(--muted); font-size: 14px; }
.flag { background: var(--mark-soft); border-radius: 6px; padding: 8px 10px; font-size: 14px; margin: 8px 0 0; }
.cands { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 8px; }
.cands li { border-top: 1px solid var(--line); padding-top: 8px; }
.cands a { font-weight: 600; }
.level { font-family: var(--font-data); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 24px 0 8px; }
dl.stances { margin: 0; }
dl.stances dt { font-weight: 600; margin-top: 12px; }
dl.stances dd { margin: 2px 0 0; }
ul.plain { padding-left: 20px; }
.cta { display: inline-block; background: var(--accent); color: var(--accent-ink); text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; margin: 8px 0; }
.signup { margin-top: 40px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
.signup h2 { margin-top: 0; }
.signup iframe { width: 100%; height: 72px; border: 0; background: transparent; }
.states { columns: 3 160px; padding: 0; list-style: none; }
footer { border-top: 1px solid var(--line); background: var(--surface); padding: 24px 0; font-size: 14px; color: var(--muted); }
`;
}

// Newsletter signup box, shown only once a beehiiv form id is set in data/site.json.
// beehiiv's loader script draws the form where the script tag sits.
function signupBox(formId) {
  if (!formId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(formId)) return "";
  return `<section class="signup"><h2>Get ballot reminders by email</h2><p class="muted">Key dates and a short, neutral rundown of your ballot. Free, no ads, unsubscribe anytime. <a href="/privacy/">Privacy</a></p><script async src="https://subscribe-forms.beehiiv.com/v3/loader.js" data-beehiiv-form="${formId}"></script></section>`;
}

function layout({ site, depth, title, description, canonical, body, jsonld, signup = "" }) {
  const up = "../".repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="${up}favicon.svg" type="image/svg+xml">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ballot Atlas">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600&family=Source+Serif+4:opsz,wght@8..60,700&family=IBM+Plex+Mono:wght@500&display=swap">
<link rel="stylesheet" href="${up}assets/pages.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<header class="top"><div><a class="brand" href="${up}">Ballot Atlas</a><nav><a href="${up}">Map</a><a href="${up}states/">States</a><a href="${up}about/">About</a></nav></div></header>
<main>
${body}
${signup}
</main>
<footer><div>Ballot Atlas is a free, nonpartisan guide to the November 3, 2026 election. Candidate profiles are researched daily from public sources and written in neutral language. Always confirm with your election office before you vote. <a href="${up}about/">How this works</a> · <a href="${up}privacy/">Privacy</a></div></footer>
</body>
</html>
`;
}

function build({ root, data, styles }) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "data", "site.json"), "utf8"));
  const site = cfg.url.replace(/\/$/, "");
  const signup = signupBox(cfg.newsletterFormId);
  const out = path.join(root, "dist");
  const write = (rel, html) => { fs.mkdirSync(path.join(out, path.dirname(rel)), { recursive: true }); fs.writeFileSync(path.join(out, rel), html); };
  const urls = [{ loc: `${site}/`, priority: "1.0" }];
  write("assets/pages.css", pageCss(styles));

  const states = Object.entries(data.states).map(([fips, st]) => ({ fips, st, slug: slug(st.name) })).sort((a, b) => a.st.name.localeCompare(b.st.name));
  const candPage = {};   // candidate id -> { st, race, place }

  for (const { st, slug: s } of states) {
    const races = [...st.races.map(r => ({ r, place: st.name })),
      ...Object.values(st.counties || {}).flatMap(c => c.races.map(r => ({ r, place: `${c.name} County, ${st.name}`, county: c.name })))];
    for (const { r, place } of races) for (const id of r.candidates) candPage[id] = candPage[id] || { st, stSlug: s, race: r, place };
  }
  // Readable addresses: /candidates/sherrod-brown/, with the state added only if two candidates share a name.
  const taken = {};
  for (const id of Object.keys(candPage)) { const n = slug(data.candidates[id].name); taken[n] = (taken[n] || 0) + 1; }
  for (const [id, w] of Object.entries(candPage)) { const n = slug(data.candidates[id].name); data.candidates[id].page = taken[n] > 1 ? `${n}-${w.stSlug}` : n; }
  const href = (id, depth) => `${"../".repeat(depth)}candidates/${data.candidates[id].page}/`;

  const raceBlock = (r, depth) => {
    const cands = r.candidates.map(id => [id, data.candidates[id]]).filter(([, c]) => c).sort((a, b) => lastName(a[1].name).localeCompare(lastName(b[1].name)));
    return `<div class="card"><h3>${esc(r.office)}</h3><p class="muted">${esc(r.about)}</p>${r.verify ? `<p class="flag">${esc(r.verify)}</p>` : ""}
<ul class="cands">${cands.map(([id, c]) => `<li><a href="${href(id, depth)}">${esc(c.name)}</a> <span class="muted">${esc([c.party, c.status].filter(Boolean).join(" · "))}</span>${c.summary ? `<br><span class="muted">${esc(clip(c.summary, 180))}</span>` : ""}</li>`).join("")}</ul></div>`;
  };

  // State pages.
  for (const { st, slug: s } of states) {
    const offices = st.races.map(r => r.office);
    const title = !offices.length ? `${st.name} 2026 election: key dates and where to vote | Ballot Atlas`
      : `${st.name} 2026 ballot: ${offices.length <= 3 ? offices.join(", ") : "statewide races"} candidates | Ballot Atlas`;
    const description = !offices.length ? `${st.name} on November 3, 2026: registration and voting deadlines, ballot measures, and where to vote.`
      : `Who is running in ${st.name} on November 3, 2026: ${offices.slice(0, 4).join(", ")}. Key dates, neutral candidate profiles with sources, and where to vote.`;
    const dates = st.dates.map(d => `<li><strong>${esc(d.label)}:</strong> ${fmt(d.start)}${d.end ? ` to ${fmt(d.end)}` : ""}. ${esc(d.note)}</li>`).join("");
    const byLevel = LEVELS.map(([lvl, label]) => {
      const rs = st.races.filter(r => r.level === lvl);
      return rs.length ? `<div class="level">${label}</div>${rs.map(r => raceBlock(r, 2)).join("")}` : "";
    }).join("");
    const counties = Object.values(st.counties || {}).map(c => `<h3 style="margin-top:20px">${esc(c.name)} County</h3>${c.races.map(r => raceBlock(r, 2)).join("")}`).join("");
    const measures = st.measures.length ? `<h2>Ballot measures</h2>${st.measures.map(m => `<div class="card"><h3>${esc(m.title)}</h3><p>${esc(m.summary)}</p><p><strong>Yes:</strong> ${esc(m.forMeans)}<br><strong>No:</strong> ${esc(m.againstMeans)}</p></div>`).join("")}` : "";
    const body = `<p class="crumbs"><a href="../../">Map</a> › <a href="../">States</a> › ${esc(st.name)}</p>
<h1>${esc(st.name)}: what's on the November 3, 2026 ballot</h1>
<p class="lede">Every candidate below is listed alphabetically, with party shown as text only. Open a name for their stated positions, background and recent news, each with sources.</p>
<a class="cta" href="../../#${s}">Open ${esc(st.name)} on the map</a>
<h2>Key dates</h2><ul class="plain">${dates}</ul>
<p class="muted">Official election information: <a href="${esc(st.officialSite.url)}" rel="noopener">${esc(st.officialSite.label)}</a></p>
<h2>Who's running</h2>${st.coverageNote ? `<p class="muted">${esc(st.coverageNote)}</p>` : ""}${byLevel}
${counties ? `<h2>County and U.S. House races</h2>${counties}` : ""}
${measures}`;
    const canonical = `${site}/states/${s}/`;
    write(`states/${s}/index.html`, layout({ site, depth: 2, title, description, canonical, body, signup,
      jsonld: { "@context": "https://schema.org", "@type": "Event", name: `${st.name} general election`, startDate: "2026-11-03", eventStatus: "https://schema.org/EventScheduled", location: { "@type": "Place", name: st.name, address: { "@type": "PostalAddress", addressRegion: st.name, addressCountry: "US" } }, url: canonical } }));
    urls.push({ loc: canonical, priority: "0.9" });
  }

  // States index.
  write("states/index.html", layout({ site, depth: 1, title: "2026 ballots by state | Ballot Atlas", description: "Choose a state to see who is running on November 3, 2026, with neutral, sourced candidate profiles.", canonical: `${site}/states/`,
    body: `<p class="crumbs"><a href="../">Map</a> › States</p><h1>2026 ballots by state</h1><p class="lede">States are being added daily, starting with U.S. Senate and governor races.</p><ul class="states">${states.map(({ st, slug: s }) => `<li><a href="${s}/">${esc(st.name)}</a></li>`).join("")}</ul>` }));
  urls.push({ loc: `${site}/states/`, priority: "0.8" });

  // Candidate pages.
  for (const [id, c] of Object.entries(data.candidates)) {
    const where = candPage[id];
    if (!where) continue;
    const { st, stSlug, race, place } = where;
    const others = race.candidates.filter(x => x !== id).map(x => [x, data.candidates[x]]).filter(([, o]) => o);
    const title = `${c.name} (${c.party}) for ${race.office}, ${place}: positions and background | Ballot Atlas`;
    const description = c.summary ? clip(c.summary, 155) : `${c.name}, ${c.party} candidate for ${race.office} in ${place} on November 3, 2026.`;
    const body = `<p class="crumbs"><a href="../../">Map</a> › <a href="../../states/${stSlug}/">${esc(st.name)}</a> › ${esc(c.name)}</p>
<h1>${esc(c.name)}</h1>
<p class="lede">${esc(c.party)} candidate for ${esc(race.office)}${race.office.includes(st.name) ? "" : `, ${esc(place)}`}${c.status ? ` · ${esc(c.status)}` : ""}</p>
${c.occupation ? `<p><strong>${esc(c.occupation)}</strong></p>` : ""}
${c.summary ? `<p>${esc(c.summary)}</p>` : `<p class="muted">This candidate hasn't been researched yet. The research agent adds profiles daily.</p>`}
${c.positions.length ? `<h2>Where ${esc(lastName(c.name))} stands</h2><dl class="stances">${c.positions.map(p => `<dt>${esc(p.topic)}</dt><dd>${esc(p.stance)}</dd>`).join("")}</dl>` : ""}
${c.history.length ? `<h2>Background</h2><ul class="plain">${c.history.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
${c.news.length ? `<h2>In the news</h2><ul class="plain">${c.news.map(n => `<li>${n.url ? `<a href="${esc(n.url)}" rel="noopener nofollow">${esc(n.headline)}</a>` : esc(n.headline)} <span class="muted">${esc(n.outlet)}${n.date ? ", " + fmt(n.date) : ""}</span></li>`).join("")}</ul>` : ""}
${others.length ? `<h2>Also running for ${esc(race.office)}</h2><ul class="plain">${others.map(([x, o]) => `<li><a href="${href(x, 2)}">${esc(o.name)}</a> <span class="muted">${esc(o.party)}</span></li>`).join("")}</ul>` : ""}
${c.sources.length ? `<h2>Sources</h2><ul class="plain">${c.sources.map(s => `<li><a href="${esc(s.url)}" rel="noopener nofollow">${esc(s.label)}</a></li>`).join("")}</ul>` : ""}
<p class="muted">${c.lastResearched ? `Last researched ${fmt(c.lastResearched)}. ` : ""}Written in neutral language from the sources above. Spot an error? See <a href="../../about/">how to report it</a>.</p>`;
    const canonical = `${site}/candidates/${c.page}/`;
    write(`candidates/${c.page}/index.html`, layout({ site, depth: 2, title, description, canonical, body, signup,
      jsonld: { "@context": "https://schema.org", "@type": "Person", name: c.name, jobTitle: c.occupation || undefined, affiliation: /^(Democratic|Republican|Libertarian|Green|Constitution)$/.test(c.party) ? { "@type": "Organization", name: `${c.party} Party` } : undefined, description: c.summary || undefined, url: canonical } }));
    urls.push({ loc: canonical, priority: "0.7", lastmod: c.lastResearched });
  }

  // About page.
  write("about/index.html", layout({ site, depth: 1, title: "About Ballot Atlas: how candidate profiles are researched", description: "How Ballot Atlas builds neutral, sourced candidate profiles every day, and how to report an error.", canonical: `${site}/about/`, body: `<p class="crumbs"><a href="../">Map</a> › About</p>
<h1>How Ballot Atlas works</h1>
<p class="lede">A free, nonpartisan guide to what's on your ballot, kept current by a research agent that runs every day.</p>
<h2>Where the information comes from</h2>
<p>Ballots come from each state's official candidate list where it can be found, then from Ballotpedia and established news outlets' voter guides. A race that couldn't be confirmed against an official list carries a note asking you to check your sample ballot.</p>
<p>Candidate profiles are researched by an AI agent (Anthropic's Claude) that searches the web, reads candidates' own websites and questionnaire answers, official records and news coverage. Every stance must cite a page the agent actually opened during that research. Anything it can't source is left out.</p>
<h2>How we keep it neutral</h2>
<ul class="plain">
<li>Stances are written in the candidate's own framing ("Supports…", "Opposes…"), never inferred from party.</li>
<li>Judging words such as "radical", "extreme" or "common-sense" are blocked; a profile containing them is held for a person to review.</li>
<li>Candidates are listed alphabetically, and parties are shown as text, not colors.</li>
<li>Candidates in the same race are asked about the same topics so they can be compared.</li>
<li>No campaign, party or PAC pays for anything on this site.</li>
</ul>
<h2>How often it updates</h2>
<p>The research agent runs every morning. Each profile is refreshed at least weekly, and news older than 45 days drops off.</p>
<h2>Report an error</h2>
<p>If something is wrong or out of date, open an issue at <a href="https://github.com/Zaied-bayati/ballot-atlas/issues">github.com/Zaied-bayati/ballot-atlas/issues</a> with the page link and a source for the correction.</p>
<h2>Before you vote</h2>
<p>Always confirm your registration, polling place and ballot with your state or county election office, or at <a href="https://vote.gov">vote.gov</a>.</p>` }));
  urls.push({ loc: `${site}/about/`, priority: "0.5" });

  // Privacy page.
  write("privacy/index.html", layout({ site, depth: 1, title: "Privacy | Ballot Atlas", description: "What Ballot Atlas collects and why.", canonical: `${site}/privacy/`, body: `<p class="crumbs"><a href="../">Map</a> › Privacy</p>
<h1>Privacy</h1>
<p class="lede">Short version: browsing Ballot Atlas doesn't require an account, and we don't sell personal information.</p>
<h2>Browsing</h2>
<p>The site has no logins and sets no advertising or tracking cookies. Our host, GitHub Pages, keeps standard server logs (such as IP addresses) for security. Fonts load from Google Fonts.</p>
<h2>Email newsletter</h2>
<p>If you sign up for reminders, your email address (and your state, if you choose to share it) is stored by our newsletter provider, beehiiv, and used only to send Ballot Atlas emails. Every email has an unsubscribe link. We never sell or share the list, and we never give it to campaigns, parties or political committees. See <a href="https://www.beehiiv.com/privacy" rel="noopener">beehiiv's privacy policy</a> for how they handle data.</p>
<h2>Questions or deletion requests</h2>
<p>Open an issue at <a href="https://github.com/Zaied-bayati/ballot-atlas/issues">github.com/Zaied-bayati/ballot-atlas/issues</a>, or unsubscribe from any email to be removed from the list.</p>
<p class="muted">Last updated October 23, 2026.</p>` }));
  urls.push({ loc: `${site}/privacy/`, priority: "0.3" });

  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`);
  write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
  return { pages: urls.length, states: states.map(s => ({ name: s.st.name, slug: s.slug })), site, signup };
}

module.exports = { build, slug };
