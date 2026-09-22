// Generates the profile cards from the GitHub API and writes them as SVG.
//
// These used to come from github-readme-activity-graph and github-readme-stats.
// Both now return 402 and 503, so the README pointed at broken images. Rendering
// them here means nothing on the profile depends on somebody else's free tier.
//
// Run: GITHUB_TOKEN=... USER=Shogo-nfrealmusic node scripts/cards.mjs

import { writeFileSync, mkdirSync } from "node:fs";

const USER = process.env.USER_LOGIN ?? "Shogo-nfrealmusic";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN is required");

const INK = "#F0F6FC";
const MUTED = "#8B949E";
const DIM = "#3D444D";
const BG = "#0D1117";
const LINE = "#21262D";
const MINT = "#5EEAD4";

const query = `
{
  user(login: "${USER}") {
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) { totalCount }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { authorization: `bearer ${TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify({ query }),
});
if (!res.ok) throw new Error(`GitHub API ${res.status}`);
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));

const c = data.user.contributionsCollection;
const days = c.contributionCalendar.weeks.flatMap((w) => w.contributionDays);

// Streaks, counted backwards from the most recent day that could still be
// filled in today. Today not having a commit yet does not break a streak.
const streaks = () => {
  let current = 0;
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (d.contributionCount > 0) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i].contributionCount > 0) current += 1;
    else if (!(i === days.length - 1)) break;
  }
  return { current, longest };
};

const { current, longest } = streaks();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const n = (x) => x.toLocaleString("en-US");

const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

mkdirSync("assets", { recursive: true });

/* ---------------------------------------------------------------- activity */
{
  const W = 1200;
  const H = 300;
  const padL = 72;
  const padR = 72;
  const padT = 74;
  const padB = 52;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const window = days.slice(-182); // roughly six months, one point per day
  const max = Math.max(...window.map((d) => d.contributionCount), 1);
  const x = (i) => padL + (i / (window.length - 1)) * plotW;
  const y = (v) => padT + plotH - (v / max) * plotH;

  // A smooth line through the points, so a dense daily series stays readable.
  const pts = window.map((d, i) => [x(i), y(d.contributionCount)]);
  let line = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = (x0 + x1) / 2;
    line += `C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  const area = `${line}L${x(window.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)}L${padL},${(padT + plotH).toFixed(1)}Z`;

  const month = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const ticks = [];
  let seen = "";
  window.forEach((d, i) => {
    const m = month(d.date);
    if (m !== seen) {
      seen = m;
      ticks.push({ i, m });
    }
  });

  const total = window.reduce((a, d) => a + d.contributionCount, 0);
  const busiest = window.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Contribution activity, last six months">
<title>Contribution activity</title>
<defs>
  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${MINT}" stop-opacity="0.22"/>
    <stop offset="1" stop-color="${MINT}" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="reveal"><rect x="0" y="0" width="0" height="${H}">
    <animate attributeName="width" from="0" to="${W}" dur="1.4s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>
  </rect></clipPath>
</defs>
<rect width="${W}" height="${H}" rx="10" fill="${BG}"/>
<rect width="${W}" height="${H}" rx="10" fill="none" stroke="${LINE}"/>
<text x="${padL}" y="40" font-family="${FONT}" font-size="15" font-weight="600" fill="${INK}">Contribution activity</text>
<text x="${padL}" y="60" font-family="${MONO}" font-size="11.5" letter-spacing="0.6" fill="${MUTED}">LAST 182 DAYS &#183; ${n(total)} CONTRIBUTIONS &#183; BUSIEST ${busiest.contributionCount} ON ${esc(busiest.date)}</text>
${[0.5, 1].map((f) => `<line x1="${padL}" y1="${(padT + plotH - f * plotH).toFixed(1)}" x2="${W - padR}" y2="${(padT + plotH - f * plotH).toFixed(1)}" stroke="${LINE}" stroke-dasharray="2 4"/>`).join("")}
<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="${LINE}"/>
<g clip-path="url(#reveal)">
  <path d="${area}" fill="url(#fill)"/>
  <path d="${line}" fill="none" stroke="${MINT}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
</g>
<text x="${W - padR}" y="${(padT - 8).toFixed(0)}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${DIM}">${max}/day</text>
${ticks.map((t) => `<text x="${x(t.i).toFixed(1)}" y="${H - 22}" font-family="${MONO}" font-size="11" letter-spacing="0.8" fill="${DIM}">${t.m}</text>`).join("")}
</svg>
`;
  writeFileSync("assets/activity.svg", svg);
}

/* ------------------------------------------------------------------- stats */
{
  const W = 1200;
  const H = 190;
  const items = [
    ["Contributions", n(c.contributionCalendar.totalContributions), "past year"],
    ["Commits", n(c.totalCommitContributions + c.restrictedContributionsCount), "public and private"],
    ["Pull requests", n(c.totalPullRequestContributions), "opened"],
    ["Repositories", n(data.user.repositories.totalCount), "not forks"],
    ["Current streak", `${n(current)}d`, "consecutive days"],
    ["Longest streak", `${n(longest)}d`, "past year"],
  ];
  const colW = (W - 144) / items.length;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="GitHub statistics">
<title>GitHub statistics</title>
<rect width="${W}" height="${H}" rx="10" fill="${BG}"/>
<rect width="${W}" height="${H}" rx="10" fill="none" stroke="${LINE}"/>
<text x="72" y="40" font-family="${FONT}" font-size="15" font-weight="600" fill="${INK}">GitHub</text>
<text x="72" y="60" font-family="${MONO}" font-size="11.5" letter-spacing="0.6" fill="${MUTED}">GENERATED IN THIS REPOSITORY, NOT BY A THIRD PARTY</text>
${items
  .map(([label, value, sub], i) => {
    const x = 72 + i * colW;
    const delay = (0.12 * i).toFixed(2);
    return `<g opacity="0" transform="translate(${x.toFixed(1)},0)">
  <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.5s" fill="freeze"/>
  ${i > 0 ? `<line x1="-24" y1="90" x2="-24" y2="150" stroke="${LINE}"/>` : ""}
  <text x="0" y="122" font-family="${FONT}" font-size="34" font-weight="700" fill="${MINT}" letter-spacing="-0.8">${value}</text>
  <text x="0" y="144" font-family="${FONT}" font-size="13" font-weight="500" fill="${INK}">${label}</text>
  <text x="0" y="162" font-family="${MONO}" font-size="10.5" letter-spacing="0.5" fill="${DIM}">${sub.toUpperCase()}</text>
</g>`;
  })
  .join("")}
</svg>
`;
  writeFileSync("assets/stats.svg", svg);
}

console.log("wrote assets/activity.svg and assets/stats.svg");
