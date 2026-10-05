// Generates the profile images and writes them as SVG.
//
//   header-{light,dark}.svg    a page header: icon, title and properties
//   stack-{light,dark}.svg     the stack as rows of tags, each with its logo
//   activity-{light,dark}.svg  four numbers and a year of contributions
//   icons/*.svg                small grey link icons, one file for both themes
//
// Each image comes in a light and a dark version and the README picks one with
// <picture>, so it sits on GitHub's background in either theme. The look follows
// a Notion page: the page icon above the title, grey property rows,
// and pastel tags.
//
// The contribution numbers used to be loaded from github-readme-stats and
// github-readme-activity-graph, whose free instances now return 402 and 503.
// Rendering them here means they cannot break again because a free tier ran out.
//
// Run: GITHUB_TOKEN=... node scripts/cards.mjs

import { writeFileSync, mkdirSync } from "node:fs";

const USER = process.env.USER_LOGIN ?? "Shogo-nfrealmusic";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN is required");

const ICONS = "https://cdn.jsdelivr.net/npm/simple-icons@16.34.0/icons";
const FONT = "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

// Notion's tag colours, light and dark.
const TAG = {
  light: {
    gray: ["#E3E2E0", "#32302C"],
    brown: ["#EEE0DA", "#442A1E"],
    orange: ["#FADEC9", "#49290E"],
    yellow: ["#FDECC8", "#402C1B"],
    green: ["#DBEDDB", "#1C3829"],
    blue: ["#D3E5EF", "#183347"],
    purple: ["#E8DEEE", "#412454"],
    pink: ["#F5E0E9", "#4C2337"],
  },
  dark: {
    gray: ["#373737", "#D4D4D4"],
    brown: ["#4A3228", "#E6D5CC"],
    orange: ["#5C3B23", "#F5D3B7"],
    yellow: ["#564328", "#F2DDB3"],
    green: ["#243D30", "#C4E3CC"],
    blue: ["#143A4E", "#BFDCEF"],
    purple: ["#3C2D49", "#E1CDEE"],
    pink: ["#4E2C3C", "#F1CCDC"],
  },
};

const THEMES = {
  light: { ink: "#37352F", muted: "#91918E", rule: "#EDEDEC", heat: ["#EFEFED", "#C7E5CF", "#8CCB9C", "#4F9F6A", "#2B6B42"] },
  dark: { ink: "#E6E6E3", muted: "#8E8E8B", rule: "#262A30", heat: ["#1C2026", "#1E4430", "#2B6B45", "#43995F", "#6FC48A"] },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
// A rough width for system sans; good enough to size a tag around its text.
const textW = (s, size) =>
  [...s].reduce((w, ch) => w + (/[ il.,·'|]/.test(ch) ? 0.3 : /[A-Z]/.test(ch) ? 0.66 : /[mwMW]/.test(ch) ? 0.82 : 0.55), 0) * size;

/* --------------------------------------------------------------- data */
const query = `
{
  user(login: "${USER}") {
    avatarUrl(size: 240)
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      restrictedContributionsCount
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, REPOSITORY]) { totalCount }
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
const weeks = c.contributionCalendar.weeks;
const n = (x) => x.toLocaleString("en-US");

const avatarRes = await fetch(data.user.avatarUrl);
const avatar = `data:${avatarRes.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(await avatarRes.arrayBuffer()).toString("base64")}`;

// Pull the path out of a simple-icons SVG (all are on a 24x24 grid).
async function logo(slug) {
  const r = await fetch(`${ICONS}/${slug}.svg`);
  if (!r.ok) throw new Error(`icon ${slug}: ${r.status}`);
  return (await r.text()).match(/ d="([^"]+)"/)[1];
}

mkdirSync("assets/icons", { recursive: true });

/* ------------------------------------------------- small property icons */
// 16x16, stroked, drawn in the muted colour.
const PROP = {
  role: `<rect x="2" y="5" width="12" height="9" rx="1.5"/><path d="M6 5V3.5A1 1 0 0 1 7 2.5h2a1 1 0 0 1 1 1V5M2 9h12"/>`,
  place: `<path d="M8 14.5s4.5-4.2 4.5-7.8a4.5 4.5 0 0 0-9 0c0 3.6 4.5 7.8 4.5 7.8Z"/><circle cx="8" cy="6.7" r="1.6"/>`,
  next: `<circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.4"/>`,
  focus: `<path d="M2.5 8.6V3.2a.7.7 0 0 1 .7-.7h5.4l5 5a1 1 0 0 1 0 1.4l-4.6 4.6a1 1 0 0 1-1.4 0Z"/><circle cx="5.6" cy="5.6" r="1"/>`,
  lang: `<path d="M2.5 3.5h8M6.5 2v1.5M4 3.5s.6 3.4 4.5 5.5M9 3.5S8.2 7 3.5 9.5M9 14l2.5-6 2.5 6M9.8 12.2h3.4"/>`,
};

/* ---------------------------------------------------------------- tags */
function tag(x, y, label, color, t, path) {
  const [bg, fg] = TAG[t][color];
  const size = 13;
  const iconW = path ? 18 : 0;
  const w = Math.round(textW(label, size) + 16 + iconW);
  return {
    w,
    svg: `<g transform="translate(${x},${y})">
  <rect width="${w}" height="24" rx="4" fill="${bg}"/>
  ${path ? `<g transform="translate(8,5.5) scale(0.54)" fill="${fg}"><path d="${path}"/></g>` : ""}
  <text x="${8 + iconW}" y="16.5" font-size="${size}" fill="${fg}">${esc(label)}</text>
</g>`,
  };
}

function tagRow(x, y, items, t) {
  let cx = x;
  return items
    .map(([label, color, path]) => {
      const g = tag(cx, y, label, color, t, path);
      cx += g.w + 6;
      return g.svg;
    })
    .join("\n");
}

/* -------------------------------------------------------------- header */
function header(name) {
  const t = THEMES[name];
  const W = 1000;
  const iconS = 96;
  const iconX = 2;
  const iconY = 4;
  const titleY = iconY + iconS + 60;
  const rowsY = titleY + 44;
  const rowH = 40;
  const labelX = 34;
  const valueX = 176;

  const rows = [
    ["role", "Role", { text: "Co-founder & CTO, TPS Collective" }],
    ["place", "Based in", { text: "Tokyo, Japan" }],
    ["next", "Next", { text: "Product Manager at Mercari, from April 2027" }],
    [
      "focus",
      "Building",
      { tags: [["Booking", "blue"], ["Payments", "green"], ["Operations", "yellow"], ["AI agents", "purple"]] },
    ],
    ["lang", "Works in", { tags: [["Japanese", "pink"], ["English", "orange"]] }],
  ];
  const H = rowsY + rows.length * rowH + 8;

  const body = rows
    .map(([ic, label, v], i) => {
      const y = rowsY + i * rowH;
      const value = v.text
        ? `<text x="${valueX}" y="${y + 21}" font-size="16" fill="${t.ink}">${esc(v.text)}</text>`
        : tagRow(valueX, y + 4, v.tags, name);
      return `<g transform="translate(6,${y + 8})" fill="none" stroke="${t.muted}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${PROP[ic]}</g>
<text x="${labelX}" y="${y + 21}" font-size="15" fill="${t.muted}">${label}</text>
${value}`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Shogo Kikuchi. Co-founder and CTO, TPS Collective. Tokyo. Product Manager at Mercari from April 2027.">
<title>Shogo Kikuchi</title>
<defs><clipPath id="iconClip"><rect x="${iconX}" y="${iconY}" width="${iconS}" height="${iconS}" rx="12"/></clipPath></defs>
<image href="${avatar}" x="${iconX}" y="${iconY}" width="${iconS}" height="${iconS}" clip-path="url(#iconClip)" preserveAspectRatio="xMidYMid slice"/>
<g font-family="${FONT}">
<text x="2" y="${titleY}" font-size="46" font-weight="700" letter-spacing="-0.8" fill="${t.ink}">Shogo Kikuchi</text>
${body}
</g>
</svg>
`;
}

/* --------------------------------------------------------------- stack */
const STACK = [
  ["Languages", "blue", [["TypeScript", "typescript"], ["JavaScript", "javascript"], ["Python", "python"], ["Go", "go"]]],
  ["Frontend", "purple", [["React", "react"], ["Next.js", "nextdotjs"], ["Tailwind CSS", "tailwindcss"]]],
  ["Backend & data", "green", [["Node.js", "nodedotjs"], ["Django", "django"], ["Supabase", "supabase"], ["PostgreSQL", "postgresql"], ["Prisma", "prisma"]]],
  ["Infrastructure", "orange", [["Vercel", "vercel"], ["Cloudflare", "cloudflare"], ["AWS", null], ["Docker", "docker"]]],
  ["AI & product", "pink", [["Claude API", "anthropic"], ["MCP", "modelcontextprotocol"], ["Stripe", "stripe"], ["GA4", "googleanalytics"], ["Search Console", "googlesearchconsole"]]],
];
const logos = Object.fromEntries(
  await Promise.all(
    STACK.flatMap(([, , items]) => items)
      .filter(([, slug]) => slug)
      .map(async ([, slug]) => [slug, await logo(slug)]),
  ),
);

function stack(name) {
  const t = THEMES[name];
  const W = 1000;
  const rowH = 46;
  const H = STACK.length * rowH;
  const rows = STACK.map(([label, color, items], i) => {
    const y = i * rowH;
    return `<text x="2" y="${y + 27}" font-size="15" fill="${t.muted}">${esc(label)}</text>
${tagRow(176, y + 10, items.map(([l, slug]) => [l, color, slug && logos[slug]]), name)}
${i < STACK.length - 1 ? `<line x1="0" y1="${y + rowH - 0.5}" x2="${W}" y2="${y + rowH - 0.5}" stroke="${t.rule}"/>` : ""}`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Stack: TypeScript, JavaScript, Python, Go, React, Next.js, Tailwind CSS, Node.js, Django, Supabase, PostgreSQL, Prisma, Vercel, Cloudflare, AWS, Docker, Claude API, MCP, Stripe, GA4, Search Console">
<title>Stack</title>
<g font-family="${FONT}">
${rows}
</g>
</svg>
`;
}

/* ------------------------------------------------------------ activity */
function activity(name) {
  const t = THEMES[name];
  const W = 1000;
  const cell = 14;
  const gap = 4;
  const gridY = 132;
  const gridX = 2;

  const figures = [
    [n(c.contributionCalendar.totalContributions), "Contributions"],
    [n(c.totalCommitContributions + c.restrictedContributionsCount), "Commits"],
    [n(c.totalPullRequestContributions), "Pull requests"],
    [n(data.user.repositoriesContributedTo.totalCount), "Repositories"],
  ];
  const colW = W / figures.length;

  const max = Math.max(...weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)), 1);
  const level = (v) => (v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

  const cells = weeks
    .map((w, wi) =>
      w.contributionDays
        .map((d) => {
          const dow = new Date(d.date).getUTCDay();
          return `<rect x="${gridX + wi * (cell + gap)}" y="${gridY + dow * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${t.heat[level(d.contributionCount)]}"/>`;
        })
        .join(""),
    )
    .join("\n");

  // A month label above the first week that starts in that month.
  let last = "";
  const months = weeks
    .map((w, wi) => {
      const m = new Date(w.contributionDays[0].date).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
      if (m === last) return "";
      last = m;
      return wi > weeks.length - 3 ? "" : `<text x="${gridX + wi * (cell + gap)}" y="${gridY - 10}" font-size="12" fill="${t.muted}">${m}</text>`;
    })
    .join("");

  const gridH = 7 * (cell + gap) - gap;
  const legendY = gridY + gridH + 24;
  const legend = t.heat
    .map((col, i) => `<rect x="${W - 40 - (5 - i) * (cell + gap) + gap}" y="${legendY - 11}" width="${cell}" height="${cell}" rx="3" fill="${col}"/>`)
    .join("");
  const H = legendY + 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${n(c.contributionCalendar.totalContributions)} contributions in the past year">
<title>Activity</title>
<g font-family="${FONT}">
${figures
  .map(
    ([value, label], i) => `<text x="${2 + i * colW}" y="36" font-size="30" font-weight="600" letter-spacing="-0.5" fill="${t.ink}">${value}</text>
<text x="${2 + i * colW}" y="62" font-size="14" fill="${t.muted}">${label}</text>`,
  )
  .join("\n")}
${months}
${cells}
<text x="${gridX}" y="${legendY}" font-size="12" fill="${t.muted}">Past year</text>
<text x="${W - 40 - 5 * (cell + gap) - 6}" y="${legendY}" text-anchor="end" font-size="12" fill="${t.muted}">Less</text>
${legend}
<text x="${W - 2}" y="${legendY}" text-anchor="end" font-size="12" fill="${t.muted}">More</text>
</g>
</svg>
`;
}

/* ---------------------------------------------------------- link icons */
// One mid-grey that reads on both backgrounds, so one file per icon.
const GREY = "#8E8E8B";
const linkIcons = {
  web: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${GREY}" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.8 3.9 6 3.9 9.5s-1.3 6.7-3.9 9.5c-2.6-2.8-3.9-6-3.9-9.5s1.3-6.7 3.9-9.5Z"/></svg>`,
  x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${GREY}"><path d="${await logo("x")}"/></svg>`,
  linkedin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${GREY}"><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h15A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5Zm3.2 5.3V18h2.6V9.8Zm1.3-4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm3.6 4V18h2.6v-4.3c0-1.2.4-2.1 1.6-2.1 1.1 0 1.4.9 1.4 2.1V18h2.6v-4.9c0-2.4-1.1-3.5-3-3.5-1.3 0-2.1.6-2.6 1.3V9.8Z"/></svg>`,
  mail: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${GREY}" stroke-width="1.8" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 6.5 9 6.5 9-6.5"/></svg>`,
};

for (const name of Object.keys(THEMES)) {
  writeFileSync(`assets/header-${name}.svg`, header(name));
  writeFileSync(`assets/stack-${name}.svg`, stack(name));
  writeFileSync(`assets/activity-${name}.svg`, activity(name));
}
for (const [k, svg] of Object.entries(linkIcons)) writeFileSync(`assets/icons/${k}.svg`, svg);

console.log("wrote assets/*.svg and assets/icons/*.svg");
