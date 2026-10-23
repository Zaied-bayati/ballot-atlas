// Daily research run: picks candidates, asks Claude (with web search) for an updated
// profile, checks every result, and writes only what passes. Everything else goes to
// data/review-queue.json for a person to look at.
//
//   node agent/research.mjs                 live run (needs ANTHROPIC_API_KEY)
//   node agent/research.mjs --dry-run       replays a saved response, writes data/ballot.preview.json
//   node agent/research.mjs --max 5         research at most 5 candidates
//   node agent/research.mjs --only paxton   research one candidate

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL, SYSTEM_PROMPT, PROFILE_SCHEMA, userPrompt } from "./prompt.mjs";
import { checkProfile, mergeProfile, pickCandidates, seenUrls } from "./validate.mjs";
import { askClaude, activity, cost, pool, openBudget } from "./claude.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const DATA = path.join(root, "data", "ballot.json");
const QUEUE = path.join(root, "data", "review-queue.json");
const BUDGET = path.join(root, "data", "budget.json");
// Worst case for one profile, including the rate-limit retry; used to hold room under the spending cap.
const MAX_JOB_USD = 1.2;

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const DRY = flag("--dry-run");
const MAX = Number(opt("--max", process.env.RESEARCH_MAX || 20));
const ONLY = opt("--only", process.env.RESEARCH_ONLY || "").split(",").map(s => s.trim()).filter(Boolean);
const EFFORT = process.env.RESEARCH_EFFORT || "low";
const SEARCHES = Number(process.env.RESEARCH_SEARCHES || 8), FETCHES = Number(process.env.RESEARCH_FETCHES || 5), PAGE_TOKENS = 6000;
// More than 2 at once trips the search tool's rate limit ("too_many_requests") and leaves profiles thin.
const CONCURRENCY = Number(process.env.RESEARCH_CONCURRENCY || 2);
// Optional: only research candidates in these states (two-letter codes), e.g. right after adding them.
const ONLY_STATES = (process.env.RESEARCH_STATES || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
const today = opt("--today", new Date().toISOString().slice(0, 10));

const readJson = (p, dflt) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return dflt; } };
const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };

async function main() {
  const data = readJson(DATA);
  const queue = readJson(QUEUE, []);
  const fipsOf = abbr => Object.keys(data.states).find(f => data.states[f].abbr === abbr);
  const onlyFips = ONLY_STATES.length ? ONLY_STATES.map(fipsOf).filter(Boolean) : null;
  let jobs = pickCandidates(data, ONLY.length || DRY ? 1e6 : MAX, today, onlyFips, ONLY.length ? ONLY : DRY ? ["paxton"] : null);
  if (DRY) jobs = jobs.slice(0, 1);

  let client = null;
  if (!DRY) {
    if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is not set. Use --dry-run to test without it."); process.exit(1); }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    client = new Anthropic();
  }
  const budget = DRY ? null : openBudget(BUDGET);
  if (budget) console.log(`Spending cap: $${budget.left().toFixed(2)} left`);
  let capped = 0;

  const log = { date: today, model: MODEL, effort: EFFORT, concurrency: CONCURRENCY, limits: { searches: SEARCHES, fetches: FETCHES, pageTokens: PAGE_TOKENS }, dryRun: DRY, results: [], costUSD: 0 };
  await pool(jobs, CONCURRENCY, async job => {
    if (budget && !budget.reserve(MAX_JOB_USD)) { capped++; return; }
    try { await research(job); } finally { if (budget) budget.settle(MAX_JOB_USD, job.spent || 0); }
  });
  async function research(job) {
    const c = data.candidates[job.id];
    const opponents = job.race.candidates.filter(x => x !== job.id).map(x => data.candidates[x]);
    const prompt = userPrompt({ candidate: c, race: job.race, place: job.place, opponents, today, searches: SEARCHES, fetches: FETCHES });

    let res;
    try {
      res = DRY ? readJson(path.join(here, "fixtures", "sample-response.json"))
        : await askClaude(client, { system: SYSTEM_PROMPT, schema: PROFILE_SCHEMA, prompt, effort: EFFORT, searches: SEARCHES, fetches: FETCHES, pageTokens: PAGE_TOKENS });
      // A rate-limited search tool returns thin profiles; wait and try once more.
      if (!DRY && activity(res.blocks || []).toolErrors.some(e => /too_many_requests/.test(e))) {
        console.log(`  ${c.name}: search tool was rate-limited, retrying in 60s`);
        await new Promise(r => setTimeout(r, 60000));
        const again = await askClaude(client, { system: SYSTEM_PROMPT, schema: PROFILE_SCHEMA, prompt, effort: EFFORT, searches: SEARCHES, fetches: FETCHES, pageTokens: PAGE_TOKENS });
        for (const k of ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]) again.usage[k] += res.usage[k] || 0;
        again.usage.server_tool_use.web_search_requests += res.usage.server_tool_use.web_search_requests;
        again.retried = true;
        res = again;
      }
    } catch (e) { res = { error: `API error: ${e.message}` }; }
    const spent = job.spent = res.usage ? cost(res.usage) : 0;
    log.costUSD += spent;
    const detail = { costUSD: +spent.toFixed(3), usage: res.usage, retried: !!res.retried, ...activity(res.blocks || []) };

    if (res.error) {
      queue.push({ date: today, candidate: job.id, name: c.name, reason: res.error });
      log.results.push({ id: job.id, status: "error", reason: res.error, ...detail });
      console.log(`✗ ${c.name}: ${res.error}`);
      return;
    }

    const check = checkProfile(res.output, { seen: seenUrls(res.blocks), today });
    if (check.ok) {
      data.candidates[job.id] = mergeProfile(c, check.profile, today);
      console.log(`✓ ${c.name}: updated (${check.profile.positions.length} stances, ${check.profile.news.length} news)` + (check.problems.length ? `, ${check.problems.length} items dropped` : ""));
    } else {
      console.log(`… ${c.name}: held for review`);
    }
    if (!check.ok || check.problems.length || check.notes) {
      queue.push({ date: today, candidate: job.id, name: c.name, applied: check.ok, held: check.held, problems: check.problems, notes: check.notes, proposed: check.ok ? undefined : check.profile });
    }
    log.results.push({ id: job.id, status: check.ok ? "updated" : "held", problems: check.problems.length, stances: check.profile.positions.length, news: check.profile.news.length, sources: check.profile.sources.length, ...detail });
  }
  if (capped) { log.stoppedAtCap = capped; console.log(`Spending cap reached: ${capped} candidates not researched.`); }

  data.meta.lastResearchRun = new Date().toISOString();
  writeJson(DRY ? path.join(root, "data", "ballot.preview.json") : DATA, data);
  writeJson(DRY ? path.join(root, "data", "review-queue.preview.json") : QUEUE, queue);
  let runFile = path.join(root, "data", "runs", `${today}${DRY ? "-dry" : ""}.json`);
  for (let n = 2; !DRY && fs.existsSync(runFile); n++) runFile = path.join(root, "data", "runs", `${today}-${n}.json`);
  writeJson(runFile, { ...log, costUSD: +log.costUSD.toFixed(2) });
  console.log(`Done: ${log.results.filter(r => r.status === "updated").length} updated, ${log.results.filter(r => r.status !== "updated").length} held or failed, about $${log.costUSD.toFixed(2)}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
