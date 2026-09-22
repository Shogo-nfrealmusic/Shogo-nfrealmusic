// Generates the profile cards from the GitHub API and writes them as SVG.
//
// The layouts follow the two projects these used to be loaded from:
//   activity.svg  ->  Ashutosh00710/github-readme-activity-graph
//                     31 days, grid, axis titles, point markers, area fill
//   stats.svg     ->  stats-organization/github-stats-extended
//                     titled card, icon rows, rank circle
//
// Those are hosted on free instances that now return 402 and 503, so the images
// were dead on the profile. Rendering them here keeps the design and removes the
// dependency.
//
// Run: GITHUB_TOKEN=... node scripts/cards.mjs

import { writeFileSync, mkdirSync } from "node:fs";

const USER = process.env.USER_LOGIN ?? "Shogo-nfrealmusic";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN is required");

// Black terminal, one green.
const BG = "#000000";
const GREEN = "#00FF41";
const GREEN_DIM = "#00B32C";
const GRID = "#0E2A16";
const TEXT = "#9BFFB4";
const MUTED = "#3F7A4F";
const BORDER = "#123D1E";

const FONT = "'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'Cascadia Mono', Menlo, monospace";

const query = `
{
  user(login: "${USER}") {
    name
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, REPOSITORY]) { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes { stargazerCount }
    }
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
const stars = data.user.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);
const commits = c.totalCommitContributions + c.restrictedContributionsCount;

const n = (x) => x.toLocaleString("en-US");
mkdirSync("assets", { recursive: true });

/* ------------------------------------------------ activity graph, 31 days */
{
  const W = 1000;
  const H = 400;
  const padT = 80;
  const padR = 50;
  const padB = 70;
  const padL = 90;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const window = days.slice(-31);
  const max = Math.max(...window.map((d) => d.contributionCount), 1);
  // Round the top of the axis up to something a tick can land on.
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * 4;

  const x = (i) => padL + (i / (window.length - 1)) * plotW;
  const y = (v) => padT + plotH - (v / top) * plotH;

  const pts = window.map((d, i) => [x(i), y(d.contributionCount)]);
  let line = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = (x0 + x1) / 2;
    line += `C${mx.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  const area = `${line}L${pts.at(-1)[0].toFixed(1)},${(padT + plotH).toFixed(1)}L${padL},${(padT + plotH).toFixed(1)}Z`;

  const label = (d) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  const yTicks = [0, 1, 2, 3, 4].map((k) => k * step);
  const xEvery = 5;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${USER} contribution graph, last 31 days">
<title>${USER}'s contribution graph</title>
<defs>
  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${GREEN}" stop-opacity="0.30"/>
    <stop offset="1" stop-color="${GREEN}" stop-opacity="0.02"/>
  </linearGradient>
  <clipPath id="wipe"><rect x="0" y="0" width="0" height="${H}">
    <animate attributeName="width" from="0" to="${W}" dur="1.5s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>
  </rect></clipPath>
</defs>

<rect width="${W}" height="${H}" rx="6" fill="${BG}" stroke="${BORDER}"/>

<text x="35" y="45" font-family="${FONT}" font-size="24" font-weight="600" fill="${GREEN}">${USER}'s contribution graph</text>
<text x="35" y="66" font-family="${MONO}" font-size="12" letter-spacing="0.5" fill="${MUTED}">LAST 31 DAYS</text>

<text transform="translate(28,${padT + plotH / 2}) rotate(-90)" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${MUTED}">Contributions</text>
<text x="${padL + plotW / 2}" y="${H - 18}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${MUTED}">Days</text>

${yTicks
  .map(
    (v) => `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" stroke="${GRID}"/>
<text x="${padL - 12}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${MUTED}">${v}</text>`,
  )
  .join("\n")}

${window
  .map((d, i) =>
    i % xEvery === 0 || i === window.length - 1
      ? `<line x1="${x(i).toFixed(1)}" y1="${padT}" x2="${x(i).toFixed(1)}" y2="${(padT + plotH).toFixed(1)}" stroke="${GRID}"/>
<text x="${x(i).toFixed(1)}" y="${(padT + plotH + 24).toFixed(1)}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${MUTED}">${label(d.date)}</text>`
      : "",
  )
  .join("\n")}

<g clip-path="url(#wipe)">
  <path d="${area}" fill="url(#area)"/>
  <path d="${line}" fill="none" stroke="${GREEN}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${pts.map(([px, py]) => `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${BG}" stroke="${GREEN}" stroke-width="1.6"/>`).join("")}
</g>
</svg>
`;
  writeFileSync("assets/activity.svg", svg);
}

/* ---------------------------------------------------------- stats card */
{
  const W = 500;
  const H = 210;

  // The rank formula from github-readme-stats, simplified: a weighted score
  // against a median developer, then bucketed.
  const score =
    commits * 1 +
    c.totalPullRequestContributions * 2 +
    c.totalIssueContributions * 1 +
    c.totalPullRequestReviewContributions * 1 +
    stars * 3 +
    data.user.repositoriesContributedTo.totalCount * 1;
  const levels = [
    [2500, "S"],
    [1600, "A+"],
    [1000, "A"],
    [600, "A-"],
    [350, "B+"],
    [180, "B"],
    [90, "B-"],
    [40, "C+"],
    [0, "C"],
  ];
  const rank = levels.find(([t]) => score >= t)[1];
  const pct = Math.min(0.97, score / 2500);
  const R = 40;
  const CIRC = 2 * Math.PI * R;

  const icon = {
    star: `<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>`,
    commit: `<path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>`,
    pr: `<path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354Z"/>`,
    issue: `<path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>`,
    repo: `<path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z"/>`,
  };

  const rows = [
    ["star", "Total Stars Earned", n(stars)],
    ["commit", "Total Commits (past year)", n(commits)],
    ["pr", "Total PRs", n(c.totalPullRequestContributions)],
    ["issue", "Total Issues", n(c.totalIssueContributions)],
    ["repo", "Contributed to (past year)", n(data.user.repositoriesContributedTo.totalCount)],
  ];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${USER}'s GitHub stats">
<title>${USER}'s GitHub stats</title>
<rect width="${W}" height="${H}" rx="6" fill="${BG}" stroke="${BORDER}"/>

<text x="25" y="35" font-family="${FONT}" font-size="18" font-weight="600" fill="${GREEN}">${data.user.name ?? USER}'s GitHub Stats</text>

<g transform="translate(${W - 100},${H / 2 - 6})">
  <circle r="${R}" fill="none" stroke="${GRID}" stroke-width="6"/>
  <circle r="${R}" fill="none" stroke="${GREEN}" stroke-width="6" stroke-linecap="round"
          transform="rotate(-90)" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}">
    <animate attributeName="stroke-dashoffset" from="${CIRC.toFixed(1)}" to="${(CIRC * (1 - pct)).toFixed(1)}"
             dur="1.2s" begin="0.3s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>
  </circle>
  <text text-anchor="middle" y="8" font-family="${FONT}" font-size="26" font-weight="700" fill="${GREEN}">${rank}</text>
</g>

${rows
  .map(([ic, label, value], i) => {
    const yy = 68 + i * 25;
    const delay = (0.15 + i * 0.1).toFixed(2);
    return `<g transform="translate(25,${yy})" opacity="0">
  <animate attributeName="opacity" from="0" to="1" begin="${delay}s" dur="0.4s" fill="freeze"/>
  <g transform="translate(0,-11) scale(0.85)" fill="${GREEN_DIM}">${icon[ic]}</g>
  <text x="25" y="0" font-family="${FONT}" font-size="14" fill="${TEXT}">${label}:</text>
  <text x="270" y="0" font-family="${MONO}" font-size="14" font-weight="600" fill="${GREEN}">${value}</text>
</g>`;
  })
  .join("\n")}
</svg>
`;
  writeFileSync("assets/stats.svg", svg);
}

console.log("wrote assets/activity.svg and assets/stats.svg");
