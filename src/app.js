(function () {
  "use strict";

  // Data ships as JSON blocks (JSON.parse is much faster than evaluating a large script literal).
  const json = id => JSON.parse(document.getElementById(id).textContent);
  const DATA = json("ballot-data");
  const LITE = json("globe-lite");
  const LEVELS = [["federal", "Federal"], ["state", "State"], ["courts", "State courts"], ["county", "County"]];

  // Simplified outlines (50 states and DC) draw the globe while zoomed out. The detailed
  // county topology is parsed only once someone zooms in or picks a state.
  const states = LITE.states;
  const stateById = new Map(states.map(f => [f.id, f]));
  let topo = null, detailed = null;
  const countiesByState = new Map();
  function loadTopo() {
    if (!topo) {
      topo = json("us-topo");
      detailed = new Map(topojson.feature(topo, topo.objects.states).features.map(f => [f.id, f]));
    }
    return topo;
  }
  function countiesOf(sid) {
    if (!countiesByState.has(sid)) {
      const t = loadTopo();
      const geometries = t.objects.counties.geometries.filter(g => g.id.slice(0, 2) === sid);
      countiesByState.set(sid, topojson.feature(t, { type: "GeometryCollection", geometries }).features);
    }
    return countiesByState.get(sid);
  }

  // ---------- Globe ----------
  // An orthographic projection: drag rotates it, scroll and pinch change its scale.
  const projection = d3.geoOrthographic();
  const path = d3.geoPath(projection).digits(1);
  // Above this zoom the detailed outlines replace the simplified ones.
  const DETAIL_K = 3.5;

  // A rough bounding circle per shape, so shapes off screen or on the far side are skipped.
  const bounds = new WeakMap();
  function circle(f) {
    let b = bounds.get(f);
    if (!b) {
      const c = d3.geoCentroid(f);
      let r = 0;
      d3.geoStream(f, { point(x, y) { r = Math.max(r, d3.geoDistance(c, [x, y])); }, lineStart() {}, lineEnd() {}, polygonStart() {}, polygonEnd() {}, sphere() {} });
      bounds.set(f, b = { c, r: r + 0.002 });
    }
    return b;
  }
  let view = { center: [0, 0], radius: Math.PI / 2 };
  const onScreen = f => { const b = circle(f); return d3.geoDistance(view.center, b.c) - b.r < view.radius; };
  const globe = { rotate: [40, -20, 0], scale: 300 };
  let W = 800, H = 600, base = 300;
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // view: "us" | "state-choice" | "state" | "county"
  const ui = { view: "us", stateId: null, countyId: null, district: null };

  const frame = document.getElementById("map-frame");
  const svg = d3.select("#map");
  const defs = svg.append("defs");
  const grad = (id, stops, attrs = {}) => {
    const g = defs.append("radialGradient").attr("id", id);
    Object.entries(attrs).forEach(([k, v]) => g.attr(k, v));
    stops.forEach(([o, c, a]) => g.append("stop").attr("offset", o).attr("stop-color", c).attr("stop-opacity", a ?? 1));
  };
  grad("ocean", [["0%", "#24563f"], ["70%", "#143a2b"], ["100%", "#0a2018"]], { cx: "42%", cy: "38%", r: "65%" });
  grad("glow", [["85%", "#4f9a75", 0.38], ["91%", "#2f6b4f", 0.14], ["100%", "#1d4a37", 0]]);
  grad("shine", [["0%", "#ffffff", 0.28], ["45%", "#ffffff", 0.06], ["100%", "#ffffff", 0]], { cx: "35%", cy: "28%", r: "70%" });
  grad("shade", [["60%", "#000000", 0], ["100%", "#000000", 0.35]]);

  const glow = svg.append("circle").attr("class", "globe-glow").attr("fill", "url(#glow)");
  const spherePath = svg.append("path").attr("class", "globe-sphere").attr("fill", "url(#ocean)").datum({ type: "Sphere" });
  const gratPath = svg.append("path").attr("class", "graticule").datum(d3.geoGraticule10());
  const landLayer = svg.append("g").attr("class", "world-land");
  landLayer.selectAll("path").data(LITE.land).join("path");
  const statesLayer = svg.append("g");
  const countiesLayer = svg.append("g").attr("class", "counties");
  const outlineLayer = svg.append("g");
  const shade = svg.append("circle").attr("class", "globe-shine").attr("fill", "url(#shade)");
  const shine = svg.append("circle").attr("class", "globe-shine").attr("fill", "url(#shine)");

  const tip = document.getElementById("tip");
  const panel = document.getElementById("panel");
  const drawer = document.getElementById("drawer");
  const drawerBody = document.getElementById("drawer-body");
  const mapBack = document.getElementById("map-back");
  const hint = document.getElementById("map-hint");

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stateData = id => DATA.states[id] || null;
  const countyData = (sid, cid) => stateData(sid)?.counties?.[cid] || null;
  const countyName = cid => countiesOf(cid.slice(0, 2)).find(c => c.id === cid)?.properties.name || "";
  const initials = name => name.split(/\s+/).map(p => p[0]).slice(0, 2).join("");
  const lastName = name => name.split(/\s+/).slice(-1)[0];

  statesLayer.selectAll("path")
    .data(states)
    .join("path")
    .attr("class", d => "state" + (stateData(d.id) ? " has-data" : ""))
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", d => d.properties.name + (stateData(d.id) ? ", ballot data available" : ""))
    .on("click", (e, d) => selectState(d.id))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectState(d.id); } })
    .on("mousemove", (e, d) => showTip(e, d.properties.name))
    .on("mouseleave", hideTip);

  const covered = states.filter(f => stateData(f.id)).map(f => f.properties.name).sort();
  const coveredList = covered.length === states.length ? "all 50 states and DC"
    : covered.length > 1 ? covered.slice(0, -1).join(", ") + " and " + covered[covered.length - 1] : covered[0];

  function showTip(e, text) {
    if (frame.classList.contains("grabbing")) return;
    const r = frameRect;
    tip.textContent = text;
    tip.style.left = (e.clientX - r.left) + "px";
    tip.style.top = (e.clientY - r.top) + "px";
    tip.hidden = false;
  }
  function hideTip() { tip.hidden = true; }

  // Redraw at the current rotation and scale. Shapes off screen or on the far side are
  // hidden without being projected; hiding them also takes them out of the keyboard tab order.
  // While the globe flies to a new state its counties stay hidden until it arrives.
  let arriving = false;
  function draw() {
    projection.rotate(globe.rotate).scale(globe.scale).translate([W / 2, H / 2]);
    const k = globe.scale / base;
    const halfDiagonal = Math.hypot(W, H) / 2;
    view = { center: [-globe.rotate[0], -globe.rotate[1]], radius: halfDiagonal >= globe.scale ? Math.PI / 2 : Math.asin(halfDiagonal / globe.scale) };
    const halo = Math.max(0, Math.min(1, (3 - k) / 2));
    [glow, shade, shine].forEach(c => c.attr("cx", W / 2).attr("cy", H / 2).attr("opacity", halo));
    glow.attr("r", globe.scale * 1.14);
    shade.attr("r", globe.scale);
    shine.attr("r", globe.scale);
    spherePath.attr("d", path);
    gratPath.attr("d", halo ? path : null).attr("opacity", halo);
    const fine = k >= DETAIL_K;
    if (fine) loadTopo();
    const put = (sel, shape = d => d) => sel.each(function (d) {
      const f = shape(d), p = onScreen(f) ? path(f) : null;
      this.setAttribute("d", p || "");
      this.style.visibility = p ? "" : "hidden";
    });
    // Neighboring land is coarse (1:110m), so it fades back once the detailed outlines take over.
    landLayer.attr("opacity", Math.max(0.35, Math.min(1, (DETAIL_K + 0.5 - k) / 1.5)));
    put(landLayer.selectAll("path"));
    put(statesLayer.selectAll("path"), d => (fine && detailed.get(d.id)) || d);
    countiesLayer.attr("display", arriving ? "none" : null);
    outlineLayer.attr("display", arriving ? "none" : null);
    if (!arriving) {
      put(countiesLayer.selectAll("path"));
      put(outlineLayer.selectAll("path"), d => (fine && detailed.get(d.id)) || d);
    }
  }
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } };

  // The rotation and scale that center a feature and make it fill `fill` of the frame.
  function fit(feature, fill, maxScale = Infinity) {
    const [lon, lat] = d3.geoCentroid(feature);
    const rotate = [-lon, -lat, 0];
    const p = d3.geoOrthographic().rotate(rotate).scale(1).translate([0, 0]);
    const [[x0, y0], [x1, y1]] = d3.geoPath(p).bounds(feature);
    const scale = Math.min(fill * W / (x1 - x0), fill * H / (y1 - y0), maxScale);
    return { rotate, scale: Math.max(scale, base * 0.7) };
  }
  // Home view: the whole globe, turned to face the lower 48.
  const usView = () => ({ rotate: [97, -36, 0], scale: base * 1.02 });

  // Drag (mouse or one finger) spins the globe; wheel, pinch and the buttons zoom it.
  // Only the change between zoom events is used, so flights never need to sync d3.zoom's own transform.
  let last = d3.zoomIdentity;
  const clampScale = s => Math.max(base * 0.7, Math.min(base * 400, s));
  const zoom = d3.zoom()
    .scaleExtent([1e-9, 1e9])
    .clickDistance(5)
    .on("start", e => {
      if (!e.sourceEvent) return;
      svg.interrupt("fly");
      hideTip();
      hint.classList.add("gone");
      if (e.sourceEvent.type !== "wheel") frame.classList.add("grabbing");
    })
    .on("zoom", e => {
      const t = e.transform;
      const type = e.sourceEvent && e.sourceEvent.type;
      if (type && type !== "wheel" && type !== "dblclick" && t.k === last.k) {
        const perPx = 180 / Math.PI / globe.scale;
        globe.rotate = [globe.rotate[0] + (t.x - last.x) * perPx, Math.max(-89, Math.min(89, globe.rotate[1] - (t.y - last.y) * perPx)), 0];
      }
      const scale = clampScale(globe.scale * t.k / last.k);
      // Zoom toward the pointer: turn the globe so the spot under it stays put.
      const at = type === "wheel" && d3.pointer(e.sourceEvent, svg.node());
      const spot = at && projection.invert(at);
      globe.scale = scale;
      if (spot && !isNaN(spot[0])) {
        const [x, y] = projection.scale(scale)(spot);
        const perPx = 180 / Math.PI / scale;
        globe.rotate = [globe.rotate[0] + (at[0] - x) * perPx, Math.max(-89, Math.min(89, globe.rotate[1] - (at[1] - y) * perPx)), 0];
      }
      last = t;
      schedule();
    })
    .on("end", () => frame.classList.remove("grabbing"));
  svg.call(zoom).on("dblclick.zoom", null);

  // Fly to a view: rotate along the short way round, and pull back mid-flight on long hops.
  function fly(target, duration = 900, arrive = false) {
    svg.interrupt("fly");
    const r0 = globe.rotate.slice(), s0 = globe.scale;
    const r1 = target.rotate.slice();
    r1[0] = r0[0] + ((((r1[0] - r0[0]) % 360) + 540) % 360 - 180);
    const ir = d3.interpolate(r0, r1);
    const ls0 = Math.log(s0), ls1 = Math.log(target.scale);
    const hop = d3.geoDistance([-r0[0], -r0[1]], [-r1[0], -r1[1]]);
    const dip = Math.min(0.55, hop * 0.9) * Math.min(1, Math.min(s0, target.scale) / base / 2);
    if (reduceMotion()) duration = 0;
    arriving = arrive;
    svg.transition("fly").duration(duration).ease(d3.easeCubicInOut)
      .tween("globe", () => t => {
        globe.rotate = ir(t);
        globe.scale = Math.exp(ls0 + (ls1 - ls0) * t) * (1 - dip * Math.sin(Math.PI * t));
        draw();
      })
      .on("end interrupt", () => {
        if (!arriving) return;
        arriving = false;
        countiesLayer.classed("arrive", false);
        void countiesLayer.node().getBoundingClientRect();
        countiesLayer.classed("arrive", true);
        draw();
      });
  }

  // Stars: a fixed field drawn once per resize on three canvases; two of them slowly
  // fade in and out (a compositor-only CSS animation), which reads as twinkling.
  const starCanvases = [...frame.querySelectorAll(".stars")];
  function drawStars() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const count = Math.round(W * H / 2600);
    starCanvases.forEach((cv, layer) => {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const ctx = cv.getContext("2d");
      ctx.scale(dpr, dpr);
      for (let i = 0; i < count / (layer ? 6 : 1); i++) {
        const x = rand() * W, y = rand() * H, big = rand() > (layer ? 0.6 : 0.94);
        const r = big ? 0.9 + rand() * 0.8 : 0.35 + rand() * 0.5;
        const tint = rand();
        ctx.fillStyle = tint > 0.85 ? "#f3e2b4" : tint > 0.7 ? "#cfe6da" : "#ffffff";
        ctx.globalAlpha = big ? 0.75 + rand() * 0.25 : 0.25 + rand() * 0.45;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
        if (big && layer) { ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, 2 * Math.PI); ctx.fill(); }
      }
    });
  }

  let frameRect = frame.getBoundingClientRect();
  function resize() {
    const r = frameRect = frame.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const k = globe.scale / base;
    W = r.width; H = r.height;
    base = Math.min(W, H) * 0.44;
    globe.scale = base * k;
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    drawStars();
    draw();
  }
  new ResizeObserver(resize).observe(frame);

  function zoomBy(f) { hint.classList.add("gone"); svg.interrupt("fly"); svg.transition().duration(reduceMotion() ? 0 : 350).call(zoom.scaleBy, f); }
  document.getElementById("zoom-in").addEventListener("click", () => zoomBy(1.8));
  document.getElementById("zoom-out").addEventListener("click", () => zoomBy(1 / 1.8));
  document.getElementById("recenter").addEventListener("click", () => fly(currentView()));

  // Arrow keys spin the globe and +/- zoom it when it has focus.
  svg.on("keydown", e => {
    if (e.target !== svg.node()) return;
    const step = 40 * 180 / Math.PI / globe.scale;
    const turn = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (turn) {
      e.preventDefault();
      globe.rotate = [globe.rotate[0] + turn[0], Math.max(-89, Math.min(89, globe.rotate[1] + turn[1])), 0];
      schedule();
    } else if (e.key === "+" || e.key === "=") zoomBy(1.5);
    else if (e.key === "-") zoomBy(1 / 1.5);
  });

  function currentView() {
    if (!ui.stateId) return usView();
    const st = stateById.get(ui.stateId);
    const sv = fit(st, 0.86, base * 120);
    if (!ui.countyId) return sv;
    // Zoom toward the county but keep the surrounding state in view.
    return fit(countiesOf(ui.stateId).find(c => c.id === ui.countyId), 0.4, sv.scale * 2.2);
  }

  function drawCounties(sid) {
    const list = sid ? countiesOf(sid) : [];
    countiesLayer.selectAll("path")
      .data(list, d => d.id)
      .join("path")
      .attr("class", d => "county" + (countyData(sid, d.id) ? " has-data" : ""))
      .on("click", (e, d) => selectCounty(d.id))
      .on("mousemove", (e, d) => showTip(e, d.properties.name + " County" + (countyData(sid, d.id) ? " · local races" : "")))
      .on("mouseleave", hideTip);
    outlineLayer.selectAll("path").data(sid ? [stateById.get(sid)] : []).join("path").attr("class", "state-outline");
  }

  function paintMap() {
    const sid = ui.stateId;
    statesLayer.selectAll(".state")
      .classed("dim", d => sid && d.id !== sid)
      .classed("active", d => d.id === sid);
    countiesLayer.selectAll(".county").classed("selected", d => d.id === ui.countyId);
    countiesLayer.classed("choosing", ui.view === "state-choice");
    mapBack.hidden = !sid;
    document.getElementById("map-back-label").textContent = ui.countyId ? stateById.get(sid).properties.name : "All states";
    svg.attr("aria-label", sid ? `Globe zoomed to ${stateById.get(sid).properties.name}. Select a county.` : "Globe centered on the United States. Select a state.");
  }

  // ---------- Navigation ----------
  function selectState(sid) {
    hideTip();
    setHash(sid);
    // States without county data skip the county question and open statewide.
    const sd = stateData(sid);
    ui.stateId = sid; ui.countyId = null; ui.view = sd && !Object.keys(sd.counties || {}).length ? "state" : "state-choice";
    drawCounties(sid);
    fly(currentView(), 1100, true);
    render();
  }
  function selectCounty(cid) {
    hideTip();
    ui.countyId = cid; ui.view = "county";
    fly(currentView());
    render();
  }
  // The address bar carries the state (e.g. #florida) so a state view can be shared.
  const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const setHash = sid => { try { history.replaceState(null, "", sid ? "#" + slugify(stateById.get(sid).properties.name) : location.pathname); } catch (e) { /* sandboxed frames */ } };

  function goUS() {
    setHash(null);
    ui.stateId = null; ui.countyId = null; ui.view = "us";
    drawCounties(null);
    fly(usView(), 1100);
    render();
  }
  function goStateLevel() {
    ui.countyId = null; ui.view = "state";
    fly(currentView());
    render();
  }
  mapBack.addEventListener("click", () => (ui.countyId ? goStateLevel() : goUS()));
  document.getElementById("brand-home").addEventListener("click", e => { e.preventDefault(); goUS(); });

  // Days until Election Day, in the top bar.
  const eday = new Date("2026-11-03T00:00:00");
  const daysLeft = Math.ceil((eday - new Date().setHours(0, 0, 0, 0)) / 864e5);
  document.getElementById("countdown").innerHTML = daysLeft > 0
    ? `<span class="long">Election Day · Nov 3 ·</span> <b>${daysLeft}</b> day${daysLeft === 1 ? "" : "s"} left`
    : daysLeft === 0 ? "<b>Election Day is today</b>" : "<span>Nov 3, 2026 general election</span>";

  // ---------- Panel ----------
  function render() {
    paintMap();
    renderCrumbs();
    if (ui.view === "us") panel.innerHTML = viewUS();
    else if (ui.view === "state-choice") panel.innerHTML = viewChoice();
    else if (ui.view === "state") panel.innerHTML = viewBallot(false);
    else panel.innerHTML = viewBallot(true);
    panel.insertAdjacentHTML("beforeend", `<p class="panel-foot">Nonpartisan and sourced, updated daily. Always confirm with your election office before you vote.</p>`);
    panel.scrollTop = 0;
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
      .map(s => `<option value="${s.id}">${esc(s.properties.name)}${stateData(s.id) ? " (loaded)" : ""}</option>`).join("");
    return `
      <div>
        <div class="eyebrow">November 3, 2026 general election</div>
        <h1>See what's on your ballot, from county races to Congress.</h1>
        <p class="lede">Spin the globe and tap your state, or pick it below. You'll see key dates, every race you can vote in, where to vote, and neutral summaries of each candidate.</p>
      </div>
      <div class="field">
        <label for="state-pick">Or choose a state from the list</label>
        <select id="state-pick"><option value="">Select a state…</option>${opts}</select>
      </div>
      <div class="howto">
        <div><b>Pick a state</b>The globe flies there and shows its counties.</div>
        <div><b>Stay statewide or pick a county</b>County view adds local races and polling places.</div>
        <div><b>Open a candidate</b>Read their goals, background and recent news, with sources.</div>
      </div>
      <p class="note">Ballot data is loaded for ${esc(coveredList)}.${covered.length < states.length ? " More states are being added." : ""}</p>`;
  }

  function viewChoice() {
    const name = esc(stateById.get(ui.stateId).properties.name);
    const sd = stateData(ui.stateId);
    if (!sd) return viewNoData(name);
    const opts = Object.entries(sd.counties).map(([id, c]) => [id, c.name]);
    const all = countiesOf(ui.stateId).map(c => c.properties.name).sort();
    return `
      <div>
        <div class="eyebrow">${name}</div>
        <h1>How local do you want to go?</h1>
        <p class="lede">Statewide races are the same for every voter in ${name}. Your county adds U.S. House, county offices and polling places.</p>
      </div>
      <div class="choice-grid">
        <button class="choice primary" type="button" data-act="state-level">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <strong>Stay at state level</strong>
          <span>Dates, statewide races and ballot measures</span>
        </button>
        <button class="choice" type="button" data-act="pick-county">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.5" fill="currentColor"/></svg>
          <strong>Choose my county</strong>
          <span>Tap it on the globe or search below</span>
        </button>
      </div>
      <div class="field">
        <label for="county-search">Find your county</label>
        <input id="county-search" list="county-list" placeholder="Start typing, e.g. Travis" autocomplete="off">
        <datalist id="county-list">${all.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      </div>
      <p class="note">${opts.length ? `Counties with local races loaded: ${opts.map(([id, n]) => `<button class="link-btn" type="button" data-county="${id}">${esc(n)}</button>`).join(", ")}.` : `No county races are loaded for ${name} yet. Choosing a county still shows your statewide races.`}</p>`;
  }

  function viewNoData(name) {
    return `
      <div>
        <div class="eyebrow">${name}</div>
        <h1>${name} isn't covered yet.</h1>
        <p class="lede">Ballot data is loaded for ${esc(coveredList)}. ${name} will be added as the research agent covers more states.</p>
      </div>
      <div class="callout">
        <p>Until then, find official dates, registration and polling places at <a href="https://vote.gov" target="_blank" rel="noopener">vote.gov</a>.</p>
      </div>
      <button class="choice" type="button" data-act="go-pilot">
        <strong>See Texas</strong>
        <span>The most complete state so far, with county races</span>
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

    const hasCounties = Object.keys(sd.counties || {}).length > 0;
    const house = cd ? `
      <div class="race house">
        <div class="race-head"><div><h3>U.S. Representative</h3><p>${cName} County is split among ${houseRaces.length} congressional districts. You vote in only one, based on your home address. Your voter registration card and the My Voter Portal on <a href="${sd.officialSite.url}" target="_blank" rel="noopener">${esc(sd.officialSite.label)}</a> show which.</p></div></div>
        <div class="field"><label for="district-pick">Your district</label>
          <select id="district-pick">${houseRaces.map(r => `<option value="${r.district}"${r.district === ui.district ? " selected" : ""}>District ${r.district}</option>`).join("")}</select></div>
      </div>${raceCard(houseRaces.find(r => r.district === ui.district))}` : (isCounty ? "" : hasCounties ? `
      <div class="callout"><p>Your U.S. House race depends on where you live. <button class="link-btn" type="button" data-act="pick-county">Choose your county</button> to see it.</p></div>` : `
      <div class="callout"><p>Your U.S. House race depends on where you live and isn't loaded for ${stateName} yet.</p></div>`);

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
      where = hasCounties
        ? `<div class="callout"><p>Each county runs its own voting sites. During early voting you can vote at any early voting site in your county.</p><p><button class="link-btn" type="button" data-act="pick-county">Choose your county</button> for local hours and links, or look them up at <a href="${sd.officialSite.url}" target="_blank" rel="noopener">${esc(sd.officialSite.label)}</a>.</p></div>`
        : `<div class="callout"><p>Polling places and hours are set locally. Look yours up at <a href="${sd.officialSite.url}" target="_blank" rel="noopener">${esc(sd.officialSite.label)}</a>, the state's official election site, or at <a href="https://vote.gov" target="_blank" rel="noopener">vote.gov</a>.</p></div>`;
    }

    const localNote = isCounty && !cd
      ? `<div class="callout"><p>Local races for ${cName} County will appear once the research agent covers it. You'll still vote in every statewide race below.</p></div>` : "";

    return `
      <div>
        <div class="eyebrow">${isCounty ? `${cName} County, ${stateName}` : `${stateName} · statewide`}</div>
        <h1>${isCounty ? `Your ballot in ${cName} County` : `What every ${stateName} voter decides`}</h1>
        <p class="lede">${isCounty ? "Statewide races, your U.S. House district and countywide offices." : "Federal and statewide races on the November 3, 2026 general election ballot."}</p>
      </div>
      ${!isCounty && hasCounties ? `<button class="choice" type="button" data-act="pick-county"><strong>Add your county</strong><span>See your U.S. House race, county races and where to vote</span></button>` : ""}
      <section class="section"><h2>Key dates</h2><ul class="dates">${dates}</ul>${sd.datesSource ? `<p class="note">Source: ${link(sd.datesSource)}</p>` : ""}</section>
      <section class="section">
        <div class="section-head"><h2>Who you can vote for</h2></div>
        <p class="note">Candidates are listed alphabetically by last name. Parties are shown as text only. ${esc(sd.coverageNote || "")}</p>
        ${localNote}${raceBlocks}
      </section>
      ${measures || sd.measuresNote || isCounty ? `<section class="section"><h2>Ballot measures</h2>${measures}${measureNote}</section>` : ""}
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
      const hit = countiesOf(ui.stateId).find(c => c.properties.name.toLowerCase() === q);
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
      ${location.protocol.startsWith("http") ? `<p><a href="candidates/${encodeURIComponent(c.page || id)}/">Full profile page</a> · easy to share and bookmark</p>` : ""}
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

  const fromHash = states.find(f => slugify(f.properties.name) === location.hash.slice(1));
  resize();
  // Parse the detailed map in idle time so zooming in later doesn't stall.
  (window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => loadTopo(), { timeout: 4000 });
  if (fromHash) selectState(fromHash.id);
  else { render(); fly(usView(), 1800); }
})();
