import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { checkProfile, mergeProfile, seenUrls, loadedWords, pickCandidates, normalizeUrl } from "./validate.mjs";

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
  const jobs = pickCandidates(data, "48", 5, today);
  assert.equal(jobs.length, 5);
  for (const j of jobs) assert.equal(data.candidates[j.id].summary, "");
});

test("profiles researched in the last week are skipped", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../data/ballot.json", import.meta.url)));
  const ids = Object.keys(data.candidates);
  for (const id of ids) data.candidates[id].lastResearched = "2026-10-20";
  assert.equal(pickCandidates(data, "48", 1e6, "2026-10-26").length, 0);
  assert.ok(pickCandidates(data, "48", 1e6, "2026-10-27").length > 0);
});
