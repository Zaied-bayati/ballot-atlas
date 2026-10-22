# Research agent

Runs once a day and keeps candidate profiles current. It never changes who is on the ballot; it only updates each candidate's background, stances, news and sources. Each profile is refreshed at most once a week, so after the first pass a daily run only picks up candidates whose profile is 7 or more days old.

## What one run does

1. Picks up to `RESEARCH_MAX` candidates (3 while costs are being tuned): never-profiled candidates first, then the ones researched longest ago, with federal races weighted highest.
2. For each one, asks Claude (`claude-opus-5-5`) to search the web and return a profile in a fixed JSON format. The instructions are in `prompt.mjs`.
3. Checks the result in code (`validate.mjs`) before anything reaches the site:
   - Every stance, news link and source must be a page Claude actually saw in this run. Anything else is dropped.
   - News must be dated within the last 45 days.
   - Judging words ("radical", "failed", "heroic", ...) hold the whole update for a person to review.
   - If Claude can't confirm the person is still a candidate, the update is held.
4. Writes passing updates to `data/ballot.json`, and everything dropped or held to `data/review-queue.json`.
5. `build.js` rebuilds the site from `data/ballot.json`.

## Running it

```bash
npm ci
npm test                                   # checks, no network
node agent/research.mjs --dry-run          # replays agent/fixtures/sample-response.json
ANTHROPIC_API_KEY=... node agent/research.mjs --only talarico
ANTHROPIC_API_KEY=... node agent/research.mjs --max 5
```

The daily schedule is `.github/workflows/daily-research.yml`. It needs a repository secret named `ANTHROPIC_API_KEY`.

## Cost

Each run's estimated cost is logged in `data/runs/<date>.json`. The first live run (medium effort, no page-length cap) cost about $1 per candidate. Runs now default to low effort, cap each fetched page at 6,000 tokens, cache the instructions, and log searches, fetches, tool errors and token usage per candidate so the cost can be traced. Raise `RESEARCH_EFFORT` if profiles come back thin.

## Reviewing held updates

Open `data/review-queue.json`. Each entry says what was dropped or held and why, and held entries include the proposed profile. To accept one, copy the fields into the candidate in `data/ballot.json`.
