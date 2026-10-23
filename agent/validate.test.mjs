import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkProfile, mergeProfile, seenUrls, loadedWords, pickCandidates, normalizeUrl, checkBallot } from "./validate.mjs";

const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/sample-response.json", import.meta.url)));
const today = "2026-10-22";
const seen = seenUrls(fixture.blocks);

test("collects URLs the model actually saw, ignoring tracking parameters", () => {
  assert.ok(seen.has(normalizeUrl("https://www.washingtontimes.com/news/2026/oct/22/ken-paxton-says-would-debate-james-talarico-texas-senate-race-terms/")));
  assert.equal(seen.size, 2);
});

test("drops stances whose source was never opened in this run", () => {
  const r = checkProfile(fixture.output, { seen, today });
  assert.equal(r.ok, true);
  assert.deepEqual(r.profile.positions.map(p => p.topic), ["Gas tax"]);
  assert.ok(r.problems.some(p => p.includes("Tariffs")));
});

test("drops news older than 45 days", () => {
  const r = checkProfile(fixture.output, { seen, today });
  assert.equal(r.profile.news.length, 1);
  assert.ok(r.problems.some(p => p.includes("outside the last 45 days")));
});

test("holds updates that use judging language", () => {
  const raw = { ...fixture.output, summary: "A radical attorney general with a failed record." };
  const r = checkProfile(raw, { seen, today });
  assert.equal(r.ok, false);
  assert.deepEqual(loadedWords(raw.summary), ["radical", "failed"]);
});

test("does not flag neutral words that contain loaded ones", () => {
  assert.deepEqual(loadedWords("Supports extremely low taxes and a patriotic holiday"), []);
});

test("holds the update when the agent cannot confirm the candidate", () => {
  const r = checkProfile({ ...fixture.output, found_profile: false, notes_for_reviewer: "Withdrew on Oct 1" }, { seen, today });
  assert.equal(r.ok, false);
});

test("merge keeps ballot fields and records the research date", () => {
  const c = { name: "Ken Paxton", party: "Republican", status: "Open seat", occupation: "", summary: "", positions: [], history: [], news: [], sources: [] };
  const merged = mergeProfile(c, checkProfile(fixture.output, { seen, today }).profile, today);
  assert.equal(merged.party, "Republican");
  assert.equal(merged.lastResearched, today);
  assert.equal(merged.positions[0].topic, "Gas tax");
});

test("merge keeps earlier stances on topics the agent did not revisit", () => {
  const c = { name: "X", party: "Y", positions: [{ topic: "Gas tax", stance: "old" }, { topic: "Schools", stance: "kept" }], history: [], news: [], sources: [] };
  const merged = mergeProfile(c, checkProfile(fixture.output, { seen, today }).profile, today);
  assert.deepEqual(merged.positions.map(p => p.stance), ["Supports permanently repealing the federal gas tax.", "kept"]);
});

test("never-profiled candidates are researched first", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../data/ballot.json", import.meta.url)));
  const jobs = pickCandidates(data, 5, today);
  assert.equal(jobs.length, 5);
  for (const j of jobs) assert.equal(data.candidates[j.id].summary, "");
});

test("profiles researched in the last week are skipped", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../data/ballot.json", import.meta.url)));
  const ids = Object.keys(data.candidates);
  for (const id of ids) data.candidates[id].lastResearched = "2026-10-20";
  assert.equal(pickCandidates(data, 1e6, "2026-10-26").length, 0);
  assert.ok(pickCandidates(data, 1e6, "2026-10-27").length > 0);
});

test("a state ballot keeps sourced races and flags the rest", () => {
  const seen = new Set([normalizeUrl("https://sos.example.gov/candidates"), normalizeUrl("https://sos.example.gov")]);
  const raw = {
    found_official_list: true,
    official_site: { label: "Example SOS", url: "https://sos.example.gov" },
    dates: [{ id: "election", label: "Election Day", start: "2026-11-04", end: "", note: "7 a.m. to 7 p.m." }, { id: "reg", label: "Registration deadline", start: "Oct 5", end: "", note: "" }],
    dates_source: { label: "Made up", url: "https://nowhere.example.com" },
    races: [
      { office: "U.S. Senator", level: "federal", seats: 1, about: "Six-year term.", candidates: [{ name: "Ana Lopez", party: "Democratic", incumbent: true }, { name: "Bo Smith", party: "Republican", incumbent: false }], source_url: "https://sos.example.gov/candidates?utm_source=x", verify: "" },
      { office: "Governor", level: "state", seats: 1, about: "Four-year term.", candidates: [{ name: "Cy Ng", party: "Republican", incumbent: false }], source_url: "https://unseen.example.com/gov", verify: "" },
      { office: "Treasurer", level: "state", seats: 1, about: "", candidates: [], source_url: "https://sos.example.gov/candidates", verify: "" }
    ],
    races_source: { label: "SOS", url: "https://sos.example.gov/candidates" },
    measures: [], measures_note: "", notes_for_reviewer: ""
  };
  const r = checkBallot(raw, { seen, abbr: "ex", name: "Example" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.races.map(x => x.id), ["ex-u-s-senator", "ex-governor"]);
  assert.equal(r.state.races[0].verify, undefined);
  assert.match(r.state.races[1].verify, /couldn't confirm/);
  assert.equal(r.candidates["ex-u-s-senator-ana-lopez"].status, "Incumbent");
  assert.equal(r.candidates["ex-u-s-senator-bo-smith"].status, "Challenger");
  assert.equal(r.candidates["ex-governor-cy-ng"].status, "Open seat");
  assert.equal(r.state.dates.find(d => d.id === "election").start, "2026-11-03");
  assert.equal(r.state.dates.length, 1);
  assert.equal(r.state.datesSource, null);
  assert.equal(r.state.officialSite.url, "https://sos.example.gov");
});

test("research can be limited to some states", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../data/ballot.json", import.meta.url)));
  assert.equal(pickCandidates(data, 1e6, today, ["99"]).length, 0);
  assert.ok(pickCandidates(data, 1e6, today, ["48"]).length > 0);
});

test("spending cap holds room for jobs in flight and stops at the cap", async () => {
  const { openBudget } = await import("./claude.mjs");
  const os = await import("node:os"), path = await import("node:path");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "budget-")), "budget.json");
  fs.writeFileSync(file, JSON.stringify({ capUSD: 3, spentUSD: 0.5 }));
  const b = openBudget(file);
  assert.equal(b.reserve(1.2), true);
  assert.equal(b.reserve(1.2), true);
  assert.equal(b.reserve(1.2), false);   // 0.5 + 2.4 + 1.2 > 3
  b.settle(1.2, 0.3);                    // spent 0.8, one job still in flight
  assert.equal(b.reserve(1.2), false);   // 0.8 + 1.2 + 1.2 > 3
  b.settle(1.2, 0.3);                    // spent 1.1, nothing in flight
  assert.equal(b.reserve(1.2), true);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).spentUSD, 1.1);
});

test("a state with no statewide races is kept when its dates or measures are sourced", () => {
  const seen = new Set([normalizeUrl("https://sos.example.gov")]);
  const base = { found_official_list: false, official_site: { label: "SOS", url: "https://sos.example.gov" }, dates: [], races: [], races_source: { label: "", url: "" }, measures: [], measures_note: "", notes_for_reviewer: "" };
  assert.equal(checkBallot({ ...base, dates_source: { label: "SOS", url: "https://sos.example.gov" } }, { seen, abbr: "ex", name: "Example" }).ok, true);
  assert.equal(checkBallot({ ...base, dates_source: { label: "X", url: "https://unseen.example.com" } }, { seen, abbr: "ex", name: "Example" }).ok, false);
});
