// Checks every agent result before it can reach the site. Pure functions, no network.

// Words that judge rather than describe. A hit holds the update for human review.
const LOADED = [
  "radical", "extremist", "extreme", "far-left", "far-right", "socialist agenda", "common-sense", "common sense",
  "failed", "disastrous", "dangerous", "heroic", "champion of", "fighting for", "slams", "blasts", "destroys",
  "outrageous", "shocking", "corrupt", "liar", "lies", "woke", "anti-american", "un-american", "patriot"
];

const LIMITS = { summary: 600, stance: 300, history: 160, positions: 10, news: 5, newsAgeDays: 45 };

export function loadedWords(text) {
  const t = String(text).toLowerCase();
  return LOADED.filter(w => new RegExp(`(^|[^a-z])${w.replace(/[-]/g, "[- ]")}([^a-z]|$)`).test(t));
}

export function normalizeUrl(u) {
  try {
    const x = new URL(u);
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(k)) x.searchParams.delete(k);
    return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/$/, "") + x.search).toLowerCase();
  } catch { return null; }
}

// Collects every URL the model actually saw in this conversation's search and fetch results.
export function seenUrls(contentBlocks) {
  const seen = new Set();
  for (const b of contentBlocks) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) seen.add(normalizeUrl(r.url));
    }
    if (b.type === "web_fetch_tool_result" && b.content && b.content.url) seen.add(normalizeUrl(b.content.url));
  }
  seen.delete(null);
  return seen;
}

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// Returns { ok, profile, problems, held } where profile contains only the parts that passed.
export function checkProfile(raw, { seen, today }) {
  const problems = [];
  const held = [];
  const cited = u => seen.has(normalizeUrl(u));

  if (!raw || typeof raw !== "object") return { ok: false, profile: null, problems: ["No usable output."], held };
  if (!raw.found_profile) problems.push("Agent could not confirm the candidate: " + (raw.notes_for_reviewer || "no notes"));

  const positions = [];
  for (const p of (raw.positions || []).slice(0, LIMITS.positions)) {
    if (!p.topic || !p.stance) continue;
    if (!cited(p.source_url)) { problems.push(`Dropped stance on "${p.topic}": its source was not in this run's search results (${p.source_url}).`); continue; }
    if (p.stance.length > LIMITS.stance) { problems.push(`Dropped stance on "${p.topic}": too long.`); continue; }
    positions.push({ topic: p.topic.trim(), stance: p.stance.trim(), source: p.source_url });
  }

  const news = [];
  for (const n of (raw.news || [])) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date)) { problems.push(`Dropped news item without a valid date: ${n.headline}`); continue; }
    const age = daysBetween(n.date, today);
    if (age < 0 || age > LIMITS.newsAgeDays) { problems.push(`Dropped news item outside the last ${LIMITS.newsAgeDays} days: ${n.headline}`); continue; }
    if (!cited(n.url)) { problems.push(`Dropped news item not seen in this run: ${n.url}`); continue; }
    news.push({ date: n.date, outlet: n.outlet.trim(), headline: n.headline.trim(), url: n.url });
  }

  const sources = (raw.sources || []).filter(s => cited(s.url)).map(s => ({ label: s.label.trim(), url: s.url }));
  for (const p of positions) if (!sources.some(s => normalizeUrl(s.url) === normalizeUrl(p.source))) sources.push({ label: new URL(p.source).host.replace(/^www\./, ""), url: p.source });

  const summary = String(raw.summary || "").trim();
  if (summary.length > LIMITS.summary) problems.push("Summary longer than 600 characters.");
  const history = (raw.history || []).map(h => String(h).trim()).filter(h => h && h.length <= LIMITS.history);

  // Neutrality: any judging word anywhere holds the whole update for a person to read.
  const text = [raw.occupation, summary, ...positions.map(p => p.stance), ...history].join(" \n ");
  const hits = loadedWords(text);
  if (hits.length) held.push(`Loaded language: ${hits.join(", ")}`);

  if (!sources.length) problems.push("No verified sources.");

  const ok = raw.found_profile && sources.length > 0 && summary.length > 0 && summary.length <= LIMITS.summary;
  return {
    ok: ok && held.length === 0,
    profile: { occupation: String(raw.occupation || "").trim(), summary, positions, history, news: news.sort((a, b) => b.date.localeCompare(a.date)).slice(0, LIMITS.news), sources },
    problems, held,
    notes: raw.notes_for_reviewer || ""
  };
}

// Applies a checked profile to a stored candidate. Ballot fields (name, party, status) never change here.
export function mergeProfile(candidate, profile, today) {
  const keepNews = (candidate.news || []).filter(n => !n.date || daysBetween(n.date, today) <= LIMITS.newsAgeDays);
  const byUrl = new Map();
  for (const n of [...profile.news, ...keepNews]) if (!byUrl.has(normalizeUrl(n.url || n.headline))) byUrl.set(normalizeUrl(n.url || n.headline), n);
  return {
    ...candidate,
    occupation: profile.occupation || candidate.occupation,
    summary: profile.summary,
    // New stances replace same-topic old ones; topics the agent didn't return this time are kept.
    positions: [...profile.positions.map(({ topic, stance }) => ({ topic, stance })),
      ...(candidate.positions || []).filter(o => !profile.positions.some(p => p.topic.toLowerCase() === o.topic.toLowerCase()))].slice(0, LIMITS.positions),
    history: profile.history.length ? profile.history : candidate.history,
    news: [...byUrl.values()].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, LIMITS.news),
    sources: profile.sources,
    lastResearched: today
  };
}

// Picks which candidates to research this run: never-profiled first, then the most stale, weighted by race.
const RACE_WEIGHT = { federal: 3, state: 2, county: 2, courts: 1 };
export const REFRESH_DAYS = 7; // a profile is refreshed at most once a week
export function pickCandidates(data, stateId, max, today) {
  const st = data.states[stateId];
  const races = [...st.races.map(r => ({ r, place: st.name })),
    ...Object.values(st.counties).flatMap(c => c.races.map(r => ({ r, place: `${c.name} County, ${st.name}` })))];
  const seen = new Set();
  const jobs = [];
  for (const { r, place } of races) for (const id of r.candidates) {
    if (seen.has(id)) continue; seen.add(id);
    const c = data.candidates[id];
    const stale = c.lastResearched ? daysBetween(c.lastResearched, today) : 999;
    if (stale < REFRESH_DAYS) continue;
    const unprofiled = !c.summary && !c.positions.length;
    jobs.push({ id, race: r, place, score: (unprofiled ? 1000 : 0) + stale * (RACE_WEIGHT[r.level] || 1) });
  }
  return jobs.sort((a, b) => b.score - a.score).slice(0, max);
}
