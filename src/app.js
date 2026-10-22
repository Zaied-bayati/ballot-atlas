(function () {
  "use strict";

  const DATA = window.BALLOT_DATA;
  const topo = window.US_TOPO;
  const W = 975, H = 610;
  const LEVELS = [["federal", "Federal"], ["state", "State"], ["courts", "State courts"], ["county", "County"]];

  const states = topojson.feature(topo, topo.objects.states).features;
  const counties = topojson.feature(topo, topo.objects.counties).features;
  const stateById = new Map(states.map(f => [f.id, f]));
  const path = d3.geoPath();

  // view: "us" | "state-choice" | "state" | "county"
  const ui = { view: "us", stateId: null, countyId: null, district: null };

  const svg = d3.select("#map");
  const zoomLayer = svg.append("g");
  const statesLayer = zoomLayer.append("g");
  const countiesLayer = zoomLayer.append("g").attr("class", "counties");
  const outlineLayer = zoomLayer.append("g");
  const tip = document.getElementById("tip");
  const panel = document.getElementById("panel");
  const drawer = document.getElementById("drawer");
  const drawerBody = document.getElementById("drawer-body");
  const mapBack = document.getElementById("map-back");

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stateData = id => DATA.states[id] || null;
  const countyData = (sid, cid) => stateData(sid)?.counties?.[cid] || null;
  const countyName = cid => counties.find(c => c.id === cid)?.properties.name || "";
  const initials = name => name.split(/\s+/).map(p => p[0]).slice(0, 2).join("");
  const lastName = name => name.split(/\s+/).slice(-1)[0];

  // ---------- Map ----------
  statesLayer.selectAll("path")
    .data(states)
    .join("path")
    .attr("class", d => "state" + (stateData(d.id) ? " has-data" : ""))
    .attr("d", path)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", d => d.properties.name + (stateData(d.id) ? ", ballot data available" : ""))
    .on("click", (e, d) => selectState(d.id))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectState(d.id); } })
    .on("mousemove", (e, d) => showTip(e, d.properties.name + (stateData(d.id) ? " · ballot data" : "")))
    .on("mouseleave", hideTip);

  // Pilot marker on the US view.
  const pilot = stateById.get(DATA.meta.pilotStateFips);
  const pilotLabel = statesLayer.append("text").attr("class", "state-label")
    .attr("x", path.centroid(pilot)[0]).attr("y", path.centroid(pilot)[1] + 4).text("PILOT");

  document.getElementById("legend").innerHTML =
    '<span><i style="background:var(--accent-soft)"></i>Ballot data</span><span><i style="background:var(--land)"></i>Coming later</span>';

  function showTip(e, text) {
    const r = svg.node().parentNode.getBoundingClientRect();
    tip.textContent = text;
    tip.style.left = (e.clientX - r.left) + "px";
    tip.style.top = (e.clientY - r.top) + "px";
    tip.hidden = false;
  }
  function hideTip() { tip.hidden = true; }

  function zoomTo(feature, fill, maxScale) {
    let t = d3.zoomIdentity;
    if (feature) {
      const [[x0, y0], [x1, y1]] = path.bounds(feature);
      const k = Math.min(maxScale, fill / Math.max((x1 - x0) / W, (y1 - y0) / H));
      t = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k);
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    zoomLayer.transition().duration(reduce ? 0 : 750).ease(d3.easeCubicInOut).attr("transform", t.toString());
  }

  function drawCounties(sid) {
    const list = sid ? counties.filter(c => c.id.slice(0, 2) === sid) : [];
    countiesLayer.selectAll("path")
      .data(list, d => d.id)
      .join("path")
      .attr("class", d => "county" + (countyData(sid, d.id) ? " has-data" : ""))
      .attr("d", path)
      .on("click", (e, d) => selectCounty(d.id))
      .on("mousemove", (e, d) => showTip(e, d.properties.name + " County" + (countyData(sid, d.id) ? " · local races" : "")))
      .on("mouseleave", hideTip);
    outlineLayer.selectAll("path").data(sid ? [stateById.get(sid)] : []).join("path").attr("class", "state-outline").attr("d", path);
  }

  function paintMap() {
    const sid = ui.stateId;
    statesLayer.selectAll(".state")
      .classed("dim", d => sid && d.id !== sid)
      .classed("active", d => d.id === sid);
    pilotLabel.attr("display", sid ? "none" : null);
    countiesLayer.selectAll(".county").classed("selected", d => d.id === ui.countyId);
    countiesLayer.classed("choosing", ui.view === "state-choice");
    mapBack.hidden = !sid;
    document.getElementById("map-back-label").textContent = ui.countyId ? stateById.get(sid).properties.name : "All states";
    svg.attr("aria-label", sid ? `Map of ${stateById.get(sid).properties.name}. Select a county.` : "Map of the United States. Select a state.");
  }

  // ---------- Navigation ----------
  function selectState(sid) {
    hideTip();
    ui.stateId = sid; ui.countyId = null; ui.view = "state-choice";
    drawCounties(sid);
    zoomTo(stateById.get(sid), 0.88, 12);
    render();
  }
  function selectCounty(cid) {
    hideTip();
    ui.countyId = cid; ui.view = "county";
    const f = counties.find(c => c.id === cid);
    const st = stateById.get(ui.stateId);
    // Zoom toward the county but keep the surrounding state in view.
    const [[sx0, sy0], [sx1, sy1]] = path.bounds(st);
    const stateScale = 0.88 / Math.max((sx1 - sx0) / W, (sy1 - sy0) / H);
    zoomTo(f, 0.4, stateScale * 2.2);
    render();
  }
  function goUS() {
    ui.stateId = null; ui.countyId = null; ui.view = "us";
    drawCounties(null);
    zoomTo(null);
    render();
  }
  function goStateLevel() {
    ui.countyId = null; ui.view = "state";
    zoomTo(stateById.get(ui.stateId), 0.88, 12);
    render();
  }
  mapBack.addEventListener("click", () => (ui.countyId ? goStateLevel() : goUS()));
  document.getElementById("brand-home").addEventListener("click", e => { e.preventDefault(); goUS(); });

  // ---------- Panel ----------
  function render() {
    paintMap();
    renderCrumbs();
    if (ui.view === "us") panel.innerHTML = viewUS();
    else if (ui.view === "state-choice") panel.innerHTML = viewChoice();
    else if (ui.view === "state") panel.innerHTML = viewBallot(false);
    else panel.innerHTML = viewBallot(true);
    wirePanel();
  }

  function renderCrumbs() {
    const parts = [`<button type="button" data-nav="us">United States</button>`];
    if (ui.stateId) {
      const name = esc(stateById.get(ui.stateId).properties.name);
      parts.push(ui.countyId ? `<button type="button" data-nav="state">${name}</button>` : `<span class="here">${name}</span>`);
    }
    if (ui.countyId) parts.push(`<span class="here">${esc(countyName(ui.countyId))} County</span>`);
    if (!ui.stateId) parts[0] = `<span class="here">United States</span>`;
    const crumbs = document.getElementById("crumbs");
    crumbs.innerHTML = parts.join('<span aria-hidden="true">›</span>');
    crumbs.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => b.dataset.nav === "us" ? goUS() : goStateLevel()));
  }

  function viewUS() {
    const opts = states.slice().sort((a, b) => a.properties.name.localeCompare(b.properties.name))
      .map(s => `<option value="${s.id}">${esc(s.properties.name)}${stateData(s.id) ? " (sample data)" : ""}</option>`).join("");
    return `
      <div>
        <div class="eyebrow">Your ballot, on a map</div>
        <h1>See what's on your ballot, from county races to Congress.</h1>
        <p class="lede">Pick your state on the map to see upcoming election dates, every race you can vote in, where to vote, and neutral summaries of each candidate.</p>
      </div>
      <div class="field">
        <label for="state-pick">Or choose a state from the list</label>
        <select id="state-pick"><option value="">Select a state…</option>${opts}</select>
      </div>
      <div class="howto">
        <div><b>1. Pick a state</b>The map zooms in and shows its counties.</div>
        <div><b>2. Stay statewide or pick a county</b>County view adds local races and polling places.</div>
        <div><b>3. Open a candidate</b>Read their goals, background and recent news, with sources.</div>
      </div>
      <p class="note">Texas is the pilot state. Other states will be added once the research agent covers them.</p>`;
  }

  function viewChoice() {
    const name = esc(stateById.get(ui.stateId).properties.name);
    const sd = stateData(ui.stateId);
    if (!sd) return viewNoData(name);
    const opts = Object.entries(sd.counties).map(([id, c]) => [id, c.name]);
    const all = counties.filter(c => c.id.slice(0, 2) === ui.stateId).map(c => c.properties.name).sort();
    return `
      <div>
        <div class="eyebrow">${name}</div>
        <h1>How local do you want to go?</h1>
        <p class="lede">Statewide races are the same for every voter in ${name}. Your county adds U.S. House, county offices and polling places.</p>
      </div>
      <div class="choice-grid">
        <button class="choice" type="button" data-act="state-level">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <strong>Stay at state level</strong>
          <span>Dates, statewide races and ballot measures</span>
        </button>
        <button class="choice" type="button" data-act="pick-county">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.5" fill="currentColor"/></svg>
          <strong>Choose my county</strong>
          <span>Tap it on the map or search below</span>
        </button>
      </div>
      <div class="field">
        <label for="county-search">Find your county</label>
        <input id="county-search" list="county-list" placeholder="Start typing, e.g. Travis" autocomplete="off">
        <datalist id="county-list">${all.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      </div>
      <p class="note">Counties with local races loaded: ${opts.map(([id, n]) => `<button class="link-btn" type="button" data-county="${id}">${esc(n)}</button>`).join(", ")}.</p>`;
  }

  function viewNoData(name) {
    return `
      <div>
        <div class="eyebrow">${name}</div>
        <h1>${name} isn't covered yet.</h1>
        <p class="lede">Texas is the pilot state. ${name} will be added once the daily research agent covers it.</p>
      </div>
      <div class="callout">
        <p>Until then, find official dates, registration and polling places at <a href="https://vote.gov" target="_blank" rel="noopener">vote.gov</a>.</p>
      </div>
      <button class="choice" type="button" data-act="go-pilot">
        <strong>See the Texas example</strong>
        <span>Jump to the pilot state</span>
      </button>`;
  }

  function dateStatus(d) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(d.start + "T00:00:00");
    const end = new Date((d.end || d.start) + "T23:59:59");
    const days = Math.round((start - today) / 864e5);
    if (end < today) return ["past", "Passed"];
    if (start <= today) return ["open", d.end ? "Open now" : "Today"];
    return ["soon", days === 1 ? "Tomorrow" : `In ${days} days`];
  }
  const fmt = iso => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  function viewBallot(isCounty) {
    const sd = stateData(ui.stateId);
    const stateName = esc(stateById.get(ui.stateId).properties.name);
    if (!sd) return viewNoData(stateName);
    const cd = isCounty ? countyData(ui.stateId, ui.countyId) : null;
    const cName = isCounty ? esc(countyName(ui.countyId)) : "";
    const houseRaces = cd ? cd.races.filter(r => r.district) : [];
    if (cd && !houseRaces.some(r => r.district === ui.district)) ui.district = houseRaces[0]?.district ?? null;
    const races = sd.races.concat(cd ? cd.races.filter(r => !r.district) : []);

    const dates = sd.dates.map(d => {
      const [cls, label] = dateStatus(d);
      const when = d.end ? `${fmt(d.start)}–<br>${fmt(d.end)}` : fmt(d.start);
      return `<li class="${cls === "past" ? "past" : ""}"><span class="when">${when}</span><span class="what"><strong>${esc(d.label)}</strong><small>${esc(d.note)}</small><span class="pill ${cls}">${label}</span></span></li>`;
    }).join("");

    const house = cd ? `
      <div class="race house">
        <div class="race-head"><div><h3>U.S. Representative</h3><p>${cName} County is split among ${houseRaces.length} congressional districts. You vote in only one, based on your home address. Your voter registration card and the My Voter Portal on <a href="${sd.officialSite.url}" target="_blank" rel="noopener">${esc(sd.officialSite.label)}</a> show which.</p></div></div>
        <div class="field"><label for="district-pick">Your district</label>
          <select id="district-pick">${houseRaces.map(r => `<option value="${r.district}"${r.district === ui.district ? " selected" : ""}>District ${r.district}</option>`).join("")}</select></div>
      </div>${raceCard(houseRaces.find(r => r.district === ui.district))}` : (isCounty ? "" : `
      <div class="callout"><p>Your U.S. House race depends on where you live. <button class="link-btn" type="button" data-act="pick-county">Choose your county</button> to see it.</p></div>`);

    const raceBlocks = LEVELS.map(([lvl, label]) => {
      const rs = races.filter(r => r.level === lvl);
      if (!rs.length && !(lvl === "federal")) return "";
      return `<div class="level-label">${label}</div>` + rs.map(raceCard).join("") + (lvl === "federal" ? house : "");
    }).join("");

    const allMeasures = sd.measures.concat(cd ? cd.measures : []);
    const measures = allMeasures.length ? allMeasures.map(m => `
      <div class="measure">
        <h3>${esc(m.title)}</h3>
        <p>${esc(m.summary)}</p>
        <div class="yesno"><div><b>A vote for</b>${esc(m.forMeans)}</div><div><b>A vote against</b>${esc(m.againstMeans)}</div></div>
        ${m.source ? `<p class="note">Source: ${link(m.source)}</p>` : ""}
      </div>`).join("") : "";
    const measureNote = `<p class="note">${esc(sd.measuresNote || "")}${isCounty ? " City, school district and other local measures aren't loaded yet. Check your sample ballot." : ""}</p>`;

    let where;
    if (cd) {
      where = `<div class="place"><strong>Early voting</strong><small>${esc(cd.voting.early)}</small></div>
        <div class="place"><strong>Election Day, Nov. 3</strong><small>${esc(cd.voting.electionDay)}</small></div>
        <div class="callout"><p>Find your exact locations, hours and wait times at <a href="${cd.officialSite.url}" target="_blank" rel="noopener">${esc(cd.officialSite.label)}</a>, the county's official elections site.</p></div>
        <p class="note">Source: ${link(cd.voting.source)}</p>`;
    } else if (isCounty) {
      where = `<div class="callout"><p>We haven't loaded ${cName} County's voting locations yet.</p><p>Find yours at <a href="${sd.officialSite.url}" target="_blank" rel="noopener">${esc(sd.officialSite.label)}</a>.</p></div>`;
    } else {
      where = `<div class="callout"><p>Each county runs its own voting sites. During early voting you can vote at any early voting site in your county.</p><p><button class="link-btn" type="button" data-act="pick-county">Choose your county</button> for local hours and links, or look them up at <a href="${sd.officialSite.url}" target="_blank" rel="noopener">${esc(sd.officialSite.label)}</a>.</p></div>`;
    }

    const localNote = isCounty && !cd
      ? `<div class="callout"><p>Local races for ${cName} County will appear once the research agent covers it. You'll still vote in every statewide race below.</p></div>` : "";

    return `
      <div>
        <div class="eyebrow">${isCounty ? `${cName} County, ${stateName}` : `${stateName} · statewide`}</div>
        <h1>${isCounty ? `Your ballot in ${cName} County` : `What every ${stateName} voter decides`}</h1>
        <p class="lede">${isCounty ? "Statewide races, your U.S. House district and countywide offices." : "Federal and statewide races on the November 3, 2026 general election ballot."}</p>
      </div>
      ${!isCounty ? `<button class="choice" type="button" data-act="pick-county"><strong>Add your county</strong><span>See your U.S. House race, county races and where to vote</span></button>` : ""}
      <section class="section"><h2>Key dates</h2><ul class="dates">${dates}</ul>${sd.datesSource ? `<p class="note">Source: ${link(sd.datesSource)}</p>` : ""}</section>
      <section class="section">
        <div class="section-head"><h2>Who you can vote for</h2></div>
        <p class="note">Candidates are listed alphabetically by last name. Parties are shown as text only. Certified write-in candidates and the Texas House, Texas Senate, State Board of Education and district court races aren't loaded yet.</p>
        ${localNote}${raceBlocks}
      </section>
      <section class="section"><h2>Ballot measures</h2>${measures}${measureNote}</section>
      <section class="section"><h2>Where to vote</h2><div class="places">${where}</div></section>`;
  }

  function link(s) { return `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`; }

  function sortedCands(race) {
    return race.candidates.map(id => [id, DATA.candidates[id]]).filter(([, c]) => c)
      .sort((a, b) => lastName(a[1].name).localeCompare(lastName(b[1].name)));
  }

  function raceCard(r) {
    if (!r) return "";
    const list = sortedCands(r);
    const cands = list.map(([id, c]) => `
      <button class="cand" type="button" data-cand="${id}">
        <span class="avatar" aria-hidden="true">${esc(initials(c.name))}</span>
        <span class="cand-text"><strong>${esc(c.name)}</strong><small>${[c.party, c.status].filter(Boolean).map(esc).join(" · ")}</small></span>
      </button>`).join("");
    const comparable = list.length > 1 && list.filter(([, c]) => c.positions.length).length > 1;
    return `
      <div class="race">
        <div class="race-head">
          <div><h3>${esc(r.office)}</h3><p>${esc(r.about)}</p></div>
          ${comparable ? `<button class="link-btn" type="button" data-compare="${r.id}">Compare</button>` : ""}
        </div>
        ${r.verify ? `<p class="flag">${esc(r.verify)}</p>` : ""}
        <div class="cands">${cands}</div>
      </div>`;
  }

  function findRace(id) {
    const sd = stateData(ui.stateId);
    const cd = countyData(ui.stateId, ui.countyId);
    return sd.races.concat(cd ? cd.races : []).find(r => r.id === id);
  }

  function wirePanel() {
    panel.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
      const act = b.dataset.act;
      if (act === "state-level") goStateLevel();
      else if (act === "go-pilot") selectState(DATA.meta.pilotStateFips);
      else if (act === "pick-county") {
        if (ui.view !== "state-choice") { ui.view = "state-choice"; render(); }
        countiesLayer.classed("choosing", false); void countiesLayer.node().getBoundingClientRect(); countiesLayer.classed("choosing", true);
        document.getElementById("county-search")?.focus({ preventScroll: true });
        document.querySelector(".map-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }));
    panel.querySelectorAll("[data-county]").forEach(b => b.addEventListener("click", () => selectCounty(b.dataset.county)));
    panel.querySelectorAll("[data-cand]").forEach(b => b.addEventListener("click", () => openCandidate(b.dataset.cand)));
    panel.querySelectorAll("[data-compare]").forEach(b => b.addEventListener("click", () => openCompare(findRace(b.dataset.compare))));
    const dpick = document.getElementById("district-pick");
    if (dpick) dpick.addEventListener("change", () => { ui.district = +dpick.value; render(); document.getElementById("district-pick").focus(); });
    const pick = document.getElementById("state-pick");
    if (pick) pick.addEventListener("change", () => pick.value && selectState(pick.value));
    const search = document.getElementById("county-search");
    if (search) search.addEventListener("change", () => {
      const q = search.value.trim().toLowerCase().replace(/ county$/, "");
      const hit = counties.find(c => c.id.slice(0, 2) === ui.stateId && c.properties.name.toLowerCase() === q);
      if (hit) selectCounty(hit.id);
    });
  }

  // ---------- Candidate drawer ----------
  const closeBtn = `<button class="close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
  const updated = new Date(DATA.meta.lastResearchRun).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const provenance = c => `<div class="provenance">
      <span>Written in neutral language from the sources below. Every claim should trace to one of them.</span>
      ${c && c.sources.length ? `<ul class="sources">${c.sources.map(s => `<li>${link(s)}</li>`).join("")}</ul>` : ""}
      <span>Last researched ${updated}${DATA.meta.sample ? " · sample data" : ""}</span></div>`;

  function openCandidate(id) {
    const c = DATA.candidates[id];
    const profiled = c.summary || c.positions.length;
    const stances = c.positions.map(p => `<div><b>${esc(p.topic)}</b>${esc(p.stance)}</div>`).join("");
    const news = c.news.length
      ? c.news.map(n => `<article><span class="src">${esc(n.outlet)}${n.date ? " · " + fmt(n.date) : ""}</span><strong>${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.headline)}</a>` : esc(n.headline)}</strong>${n.summary ? `<span>${esc(n.summary)}</span>` : ""}</article>`).join("")
      : `<p class="empty">No recent coverage collected yet.</p>`;
    drawerBody.innerHTML = `
      <div class="drawer-top">
        <div>
          <div class="eyebrow">Candidate</div>
          <h2 id="drawer-title">${esc(c.name)}</h2>
          <div class="meta-row">${[c.party, c.status].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
        </div>
        ${closeBtn}
      </div>
      ${c.occupation ? `<p class="occupation">${esc(c.occupation)}</p>` : ""}
      ${c.summary ? `<p style="margin:0">${esc(c.summary)}</p>` : ""}
      ${!profiled ? `<div class="callout"><p>We haven't researched this candidate yet. The daily research agent will add their background, goals and news.</p></div>` : ""}
      ${c.objectives.length ? `<section><h3>What they want to do in office</h3><ul>${c.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ul></section>` : ""}
      ${stances ? `<section><h3>Where they stand</h3><div class="stances">${stances}</div></section>` : ""}
      ${c.history.length ? `<section><h3>Background</h3><ul>${c.history.map(h => `<li>${esc(h)}</li>`).join("")}</ul></section>` : ""}
      ${profiled ? `<section><h3>In the news</h3><div class="news">${news}</div></section>` : ""}
      ${provenance(c)}`;
    showDrawer();
  }

  function openCompare(race) {
    const cs = sortedCands(race).map(([, c]) => c);
    const topics = [];
    cs.forEach(c => c.positions.forEach(p => { if (!topics.includes(p.topic)) topics.push(p.topic); }));
    const stance = (c, t) => (c.positions.find(p => p.topic === t) || {}).stance;
    drawerBody.innerHTML = `
      <div class="drawer-top">
        <div><div class="eyebrow">Compare candidates</div><h2 id="drawer-title">${esc(race.office)}</h2></div>
        ${closeBtn}
      </div>
      <div class="compare-wrap"><table class="compare">
        <thead><tr><th></th>${cs.map(c => `<th>${esc(c.name)}<br><small style="font-weight:400;color:var(--muted)">${esc(c.party)}</small></th>`).join("")}</tr></thead>
        <tbody>${topics.map(t => `<tr><th scope="row">${esc(t)}</th>${cs.map(c => `<td>${stance(c, t) ? esc(stance(c, t)) : `<span class="muted">No stated position found</span>`}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      ${provenance(null)}`;
    showDrawer();
  }

  function showDrawer() {
    drawerBody.querySelector("[data-close]").addEventListener("click", () => drawer.close());
    if (!drawer.open) drawer.showModal();
    drawer.scrollTop = 0;
  }
  drawer.addEventListener("click", e => { if (e.target === drawer) drawer.close(); });

  render();
})();
