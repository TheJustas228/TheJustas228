#!/usr/bin/env node
// Generates language cards as static SVGs committed to this repo.
// Replaces github-profile-summary-cards.vercel.app, whose shared API token
// rate-limits and renders an error card instead of the chart.
import { writeFileSync, mkdirSync } from "node:fs";

const USER = process.env.GH_USER || "TheJustas228";
const TOKEN = process.env.GITHUB_TOKEN;
const H = { Accept: "application/vnd.github+json", "User-Agent": USER, ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

// GitHub's official language colours (subset covering this account).
const COLORS = {
  Python: "#3572A5", Rust: "#dea584", TypeScript: "#3178c6", JavaScript: "#f1e05a",
  Java: "#b07219", HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051", C: "#555555",
  "C++": "#f34b7d", "C#": "#178600", Go: "#00ADD8", Ruby: "#701516", PHP: "#4F5D95",
  "Jupyter Notebook": "#DA5B0B", Dockerfile: "#384d54", Makefile: "#427819", Vue: "#41b883",
};
const colorFor = (l) => COLORS[l] || "#8b949e";

async function api(path) {
  const r = await fetch(`https://api.github.com${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${r.statusText}`);
  return r.json();
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Mid-tone greys chosen to stay legible on GitHub light (#ffffff) AND dark (#0d1117).
const TITLE = "#58a6ff", TEXT = "#7d8590", TRACK = "#7d859033";

function card(title, rows, { unit }) {
  const W = 400, rowH = 22, top = 46;
  const H_ = top + rows.length * rowH + 12;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const bars = rows.map((r, i) => {
    const y = top + i * rowH;
    const bw = Math.max(2, Math.round((r.value / max) * 150));
    return `
  <text x="16" y="${y + 4}" fill="${TEXT}" font-size="12">${esc(r.label)}</text>
  <rect x="150" y="${y - 7}" width="150" height="9" rx="4.5" fill="${TRACK}"/>
  <rect x="150" y="${y - 7}" width="${bw}" height="9" rx="4.5" fill="${colorFor(r.label)}"/>
  <text x="312" y="${y + 4}" fill="${TEXT}" font-size="11">${esc(r.display ?? r.value + unit)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H_}" viewBox="0 0 ${W} ${H_}" role="img" aria-label="${esc(title)}">
  <style>text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Ubuntu,Sans-Serif;dominant-baseline:middle}</style>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H_ - 1}" rx="8" fill="none" stroke="${TRACK}"/>
  <text x="16" y="24" fill="${TITLE}" font-size="15" font-weight="600">${esc(title)}</text>${bars}
</svg>`;
}

const repos = (await api(`/users/${USER}/repos?per_page=100&type=owner`)).filter((r) => !r.fork && !r.archived);
console.log(`public non-fork repos: ${repos.length}`);

// Card 1 - repos per language
const byRepo = {};
for (const r of repos) if (r.language) byRepo[r.language] = (byRepo[r.language] || 0) + 1;
const c1 = Object.entries(byRepo).sort((a, b) => b[1] - a[1]).slice(0, 5)
  .map(([label, value]) => ({ label, value, display: `${value} repo${value > 1 ? "s" : ""}` }));

// Card 2 - bytes of code per language
const bytes = {};
for (const r of repos) {
  try {
    const langs = await api(`/repos/${USER}/${r.name}/languages`);
    for (const [l, b] of Object.entries(langs)) bytes[l] = (bytes[l] || 0) + b;
  } catch (e) { console.warn(`  skip ${r.name}: ${e.message}`); }
}
const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
const c2 = Object.entries(bytes).sort((a, b) => b[1] - a[1]).slice(0, 5)
  .map(([label, value]) => ({ label, value, display: `${((value / total) * 100).toFixed(1)}%` }));

mkdirSync("assets", { recursive: true });
writeFileSync("assets/top-languages.svg", card("Top Languages by Repo", c1, { unit: "" }));
writeFileSync("assets/language-bytes.svg", card("Language Distribution by Size", c2, { unit: "" }));
console.log("card 1:", c1.map((r) => `${r.label}=${r.display}`).join(", "));
console.log("card 2:", c2.map((r) => `${r.label}=${r.display}`).join(", "));
