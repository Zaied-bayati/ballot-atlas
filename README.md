# Ballot Atlas

A map-first voter guide. Pick your state, zoom into your county, and see every race on your ballot, key dates, where to vote, and neutral, sourced profiles of each candidate. Texas is the pilot state for the November 3, 2026 general election.

- `src/` page template, styles and app code
- `data/ballot.json` races, candidates and voting info (the research agent updates this)
- `agent/` the daily research agent ([how it works](agent/README.md))
- `build.js` builds `dist/index.html`, a single self-contained page
- `.github/workflows/` daily research run and GitHub Pages publishing

```bash
npm ci
npm test
node build.js        # then open dist/index.html
```
