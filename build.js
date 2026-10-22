// Inlines styles, data, app code and map geometry into one self-contained page.
const fs = require("fs");
const read = p => fs.readFileSync(__dirname + "/" + p, "utf8");
const topo = JSON.stringify(JSON.parse(read("vendor/counties-albers-10m.json")));
let html = read("src/index.html");
html = html.replace("/*STYLES*/", () => read("src/styles.css"))
  .replace("/*TOPO*/", () => topo)
  .replace("/*DATA*/", () => "window.BALLOT_DATA = " + read("data/ballot.json").trim().replace(/</g, "\\u003c") + ";")
  .replace("/*APP*/", () => read("src/app.js"));
fs.mkdirSync(__dirname + "/dist", { recursive: true });
fs.writeFileSync(__dirname + "/dist/ballot-atlas.html", html);
// Standalone page for GitHub Pages: the same content inside a full HTML document.
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="See what's on your ballot: election dates, every race and neutral, sourced candidate profiles.">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${html}
</body>
</html>
`;
fs.writeFileSync(__dirname + "/dist/index.html", page);
console.log("wrote dist/ballot-atlas.html and dist/index.html", (html.length / 1024).toFixed(0) + " KB");
