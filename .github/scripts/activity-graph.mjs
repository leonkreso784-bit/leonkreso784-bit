// Crta graf aktivnosti (doprinosi po danu, zadnjih 31 dan) kao SVG — bez vanjskog servisa i bez tokena.
// Izvor: javni kalendar doprinosa https://github.com/users/<korisnik>/contributions.
//
// Zašto ne github-readme-activity-graph.vercel.app: javna instanca je ugašena (HTTP 402
// DEPLOYMENT_DISABLED, izmjereno 12.10.2026.), a tuđa kopija može nestati bilo kad.
//
// Pokreni: node .github/scripts/activity-graph.mjs <korisnik> <izlaz.svg>
// Pada GLASNO (izlaz 1) ako stranica ne izgleda kako očekuje — tada ostaje zadnja dobra slika.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Svaka greška kao GitHub anotacija (`::error::`) — anotacije su javne, logovi traže admin prava.
const prijavi = (e) => { console.log('::error::activity-graph: ' + String((e && (e.stack || e.message)) || e).replace(/\r?\n/g, '%0A')); process.exit(1); };
process.on('uncaughtException', prijavi);
process.on('unhandledRejection', prijavi);

const [korisnik = 'leonkreso784-bit', izlaz = 'dist/activity-graph.svg'] = process.argv.slice(2);
const DANA = 31;

const res = await fetch(`https://github.com/users/${korisnik}/contributions`, { headers: { 'User-Agent': 'activity-graph' } });
if (!res.ok) throw new Error(`HTTP ${res.status} za kalendar doprinosa`);
const html = await res.text();

// dan: <td data-date="2026-10-10" id="contribution-day-component-6-51" …>
// broj: <tool-tip for="contribution-day-component-6-51" …>94 contributions on October 10th.</tool-tip>
const datumPoId = new Map();
for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"[^>]*?\bid="([^"]+)"/g)) datumPoId.set(m[2], m[1]);
const brojPoDatumu = new Map();
for (const m of html.matchAll(/<tool-tip[^>]*?\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
  const datum = datumPoId.get(m[1]);
  if (!datum) continue;
  const n = /^(\d+) contributions?/.exec(m[2].trim());
  brojPoDatumu.set(datum, n ? Number(n[1]) : 0);   // „No contributions on …" = 0
}
if (datumPoId.size < 300 || brojPoDatumu.size < 300) {
  prijavi(`Kalendar ne izgleda kako treba: ${datumPoId.size} dana, ${brojPoDatumu.size} brojki (očekivano ≥ 300); HTTP ${res.status}, ${html.length} B`);
}

const sviDatumi = [...brojPoDatumu.keys()].sort();
const dani = sviDatumi.slice(-DANA).map((d) => ({ d, n: brojPoDatumu.get(d) }));

// ── crtanje ──
const W = 850, H = 300, L = 55, R = 25, T = 25, B = 60;
const sirina = W - L - R, visina = H - T - B;
const max = Math.max(5, ...dani.map((x) => x.n));
const korak = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find((k) => max / k <= 6) || Math.ceil(max / 6);
const vrh = Math.ceil(max / korak) * korak;
const X = (i) => L + (i * sirina) / (dani.length - 1);
const Y = (n) => T + visina - (n * visina) / vrh;
const P = dani.map((x, i) => [X(i), Y(x.n)]);

// monotona kubna krivulja (Fritsch–Carlson): glatka, ali nikad ispod nule ni iznad vrha točaka
function krivulja(p) {
  const n = p.length, dx = [], m = [], t = new Array(n);
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(p[i][0] + h).toFixed(1)},${(p[i][1] + t[i] * h).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)},${(p[i + 1][1] - t[i + 1] * h).toFixed(1)} ${p[i + 1][0].toFixed(1)},${p[i + 1][1].toFixed(1)}`;
  }
  return d;
}

const BOJA = '#7C3AED', TOCKA = '#C9D1D9', POZADINA = '#0D1117', MREZA = '#1F2335';
const yOznake = [];
for (let v = 0; v <= vrh; v += korak) yOznake.push(v);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Ubuntu, sans-serif">
  <title>${korisnik}: doprinosi zadnjih ${DANA} dana (${dani[0].d} – ${dani[dani.length - 1].d})</title>
  <rect width="${W}" height="${H}" fill="${POZADINA}" rx="6"/>
  ${yOznake.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${MREZA}" stroke-width="1"/>
  <text x="${L - 10}" y="${(Y(v) + 4).toFixed(1)}" fill="${BOJA}" font-size="11" text-anchor="end">${v}</text>`).join('\n  ')}
  ${dani.map((x, i) => `<line x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${T}" y2="${T + visina}" stroke="${MREZA}" stroke-width="1"/>
  <text x="${X(i).toFixed(1)}" y="${T + visina + 18}" fill="${BOJA}" font-size="11" text-anchor="middle">${Number(x.d.slice(8))}</text>`).join('\n  ')}
  <path d="${krivulja(P)}" fill="none" stroke="${BOJA}" stroke-width="3" stroke-linecap="round"/>
  ${P.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${TOCKA}"><title>${dani[i].d}: ${dani[i].n}</title></circle>`).join('\n  ')}
  <text x="${L + sirina / 2}" y="${H - 12}" fill="${BOJA}" font-size="12" text-anchor="middle">Days</text>
  <text x="16" y="${T + visina / 2}" fill="${BOJA}" font-size="12" text-anchor="middle" transform="rotate(-90 16 ${T + visina / 2})">Contributions</text>
</svg>
`;
mkdirSync(dirname(izlaz), { recursive: true });
writeFileSync(izlaz, svg);
console.log(`✓ ${izlaz}: ${dani.length} dana (${dani[0].d} – ${dani[dani.length - 1].d}), zbroj ${dani.reduce((s, x) => s + x.n, 0)}, najviše ${max} · iz kalendara pročitano ${brojPoDatumu.size} dana`);
