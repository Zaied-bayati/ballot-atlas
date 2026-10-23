// Builds the statewide ballot for states that aren't on the site yet: races, candidates,
// key dates and the official election site. Candidate profiles are filled in afterwards
// by research.mjs, which picks up every unprofiled candidate.
//
//   node agent/ballot.mjs --states FL,GA,MI --scope top     U.S. Senate and governor only
//   node agent/ballot.mjs --states AZ --scope all           every statewide race and measure
//   node agent/ballot.mjs --states FL --force                rebuild a state already on the site

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL } from "./prompt.mjs";
import { BALLOT_SYSTEM_PROMPT, BALLOT_SCHEMA, ballotPrompt } from "./ballot-prompt.mjs";
import { checkBallot, seenUrls } from "./validate.mjs";
import { askClaude, activity, cost, pool, openBudget } from "./claude.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const DATA = path.join(root, "data", "ballot.json");
const QUEUE = path.join(root, "data", "review-queue.json");
const BUDGET = path.join(root, "data", "budget.json");
const MAX_JOB_USD = 1.5;

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const STATES = String(opt("--states", process.env.BALLOT_STATES || "")).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
const SCOPE = opt("--scope", process.env.BALLOT_SCOPE || "top");
const FORCE = args.includes("--force");
const EFFORT = process.env.BALLOT_EFFORT || "medium";
const SEARCHES = SCOPE === "top" ? 6 : 12, FETCHES = SCOPE === "top" ? 4 : 8, PAGE_TOKENS = 10000;
const today = opt("--today", new Date().toISOString().slice(0, 10));

const COVERAGE = {
  top: "Only the U.S. Senate and governor races are loaded so far. Other statewide offices, ballot measures, U.S. House and local races aren't loaded yet. Check your sample ballot for the full list.",
  all: "Statewide races are loaded. U.S. House, state legislature and local races aren't loaded yet. Check your sample ballot for the full list."
};

const ABBR = { AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56" };

const readJson = (p, dflt) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return dflt; } };
const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };

async function main() {
  if (!STATES.length) { console.error("Pass --states, e.g. --states FL,GA"); process.exit(1); }
  const bad = STATES.filter(s => !ABBR[s]);
  if (bad.length) { console.error(`Unknown state code: ${bad.join(", ")}`); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }

  const data = readJson(DATA);
  const queue = readJson(QUEUE, []);
  const names = Object.fromEntries(readJson(path.join(root, "vendor", "counties-albers-10m.json")).objects.states.geometries.map(g => [g.id, g.properties.name]));
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const todo = STATES.filter(s => FORCE || !data.states[ABBR[s]]);
  for (const s of STATES.filter(s => !todo.includes(s))) console.log(`- ${s}: already on the site, skipped (use --force to rebuild)`);

  const log = { date: today, kind: "ballot", model: MODEL, effort: EFFORT, scope: SCOPE, limits: { searches: SEARCHES, fetches: FETCHES, pageTokens: PAGE_TOKENS }, results: [], costUSD: 0 };
  const budget = openBudget(BUDGET);
  if (budget) console.log(`Spending cap: $${budget.left().toFixed(2)} left`);
  await pool(todo, 5, async abbr => {
    if (budget && !budget.reserve(MAX_JOB_USD)) { console.log(`- ${abbr}: skipped, spending cap reached`); log.results.push({ state: abbr, status: "capped" }); return; }
    const j = { spent: 0 };
    try { await build(abbr, j); } finally { if (budget) budget.settle(MAX_JOB_USD, j.spent); }
  });
  async function build(abbr, j) {
    const fips = ABBR[abbr], name = names[fips];
    let res;
    try {
      res = await askClaude(client, { system: BALLOT_SYSTEM_PROMPT, schema: BALLOT_SCHEMA, prompt: ballotPrompt({ name, today, searches: SEARCHES, fetches: FETCHES, scope: SCOPE }), effort: EFFORT, searches: SEARCHES, fetches: FETCHES, pageTokens: PAGE_TOKENS });
    } catch (e) { res = { error: `API error: ${e.message}` }; }
    const spent = j.spent = res.usage ? cost(res.usage) : 0;
    log.costUSD += spent;
    const detail = { costUSD: +spent.toFixed(3), usage: res.usage, ...activity(res.blocks || []) };

    if (res.error) {
      queue.push({ date: today, state: abbr, reason: res.error });
      log.results.push({ state: abbr, status: "error", reason: res.error, ...detail });
      console.log(`✗ ${name}: ${res.error}`);
      return;
    }
    const check = checkBallot(res.output, { seen: seenUrls(res.blocks), abbr: abbr.toLowerCase(), name });
    if (check.ok) {
      // Drop the old candidates of a rebuilt state so they don't linger.
      if (data.states[fips]) for (const r of data.states[fips].races) for (const id of r.candidates) delete data.candidates[id];
      data.states[fips] = { ...check.state, abbr, coverageNote: COVERAGE[SCOPE] };
      Object.assign(data.candidates, check.candidates);
      console.log(`✓ ${name}: ${check.state.races.length} races, ${Object.keys(check.candidates).length} candidates` + (check.officialList ? ", checked against the official list" : ", official list not found"));
    } else {
      console.log(`… ${name}: held for review`);
    }
    if (!check.ok || check.problems.length || check.notes) queue.push({ date: today, state: abbr, applied: check.ok, problems: check.problems, notes: check.notes, proposed: check.ok ? undefined : check.state });
    log.results.push({
      state: abbr, status: check.ok ? "added" : "held", officialList: check.officialList,
      races: check.state ? check.state.races.map(r => ({ office: r.office, candidates: r.candidates.map(id => `${check.candidates[id].name} (${check.candidates[id].party})`), verify: r.verify || "" })) : [],
      problems: check.problems, ...detail
    });
  }

  data.meta.lastResearchRun = new Date().toISOString();
  writeJson(DATA, data);
  writeJson(QUEUE, queue);
  let runFile = path.join(root, "data", "runs", `${today}-ballots.json`);
  for (let n = 2; fs.existsSync(runFile); n++) runFile = path.join(root, "data", "runs", `${today}-ballots-${n}.json`);
  writeJson(runFile, { ...log, costUSD: +log.costUSD.toFixed(2) });
  console.log(`Done: ${log.results.filter(r => r.status === "added").length} states added, about $${log.costUSD.toFixed(2)}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
