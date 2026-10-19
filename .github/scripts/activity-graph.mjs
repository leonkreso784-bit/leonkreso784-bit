// Crta graf aktivnosti (doprinosi po danu, zadnjih 31 dan) kao ANIMIRANI SVG — bez vanjskog servisa i bez tokena.
// Izvor: javni kalendar doprinosa https://github.com/users/<korisnik>/contributions.
//
// Animacija (CSS u SVG-u, GitHub je prikazuje u README-u): linija se sama nacrta slijeva nadesno, ispod nje izroni
// sjaj, točke iskaču redom, najjači dan dobije 🔥 i broj, a današnja točka lagano pulsira. Uz
// `prefers-reduced-motion` sve stoji odmah na mjestu.
//
// Zašto ne github-readme-activity-graph.vercel.app: javna instanca je ugašena (HTTP 402
// DEPLOYMENT_DISABLED, izmjereno 12.10.2026.), a tuđa kopija može nestati bilo kad.
//
// Pokreni: node .github/scripts/activity-graph.mjs <korisnik> <izlaz.svg>
// Pada GLASNO (izlaz 1) ako stranica ne izgleda kako očekuje — tada ostaje zadnja dobra slika.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { kalendar } from './kalendar.mjs';

const [korisnik = 'leonkreso784-bit', izlaz = 'dist/activity-graph.svg'] = process.argv.slice(2);
const DANA = 31;

const sve = await kalendar(korisnik);
const dani = sve.slice(-DANA).map((c) => ({ d: c.datum, n: c.broj }));

// ── brojke za zaglavlje ──
const ukupno = dani.reduce((s, x) => s + x.n, 0);
const danas = dani[dani.length - 1].n;
// niz: uzastopni dani s barem jednim doprinosom do danas (ako danas još nema ništa, broji se do jučer)
let niz = 0;
for (let i = sve.length - 1 - (sve[sve.length - 1].broj === 0 ? 1 : 0); i >= 0 && sve[i].broj > 0; i--) niz++;

// ── crtanje ──
const W = 850, H = 320, L = 55, R = 30, T = 78, B = 50;
const sirina = W - L - R, visina = H - T - B;
const max = Math.max(5, ...dani.map((x) => x.n));
const korak = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find((k) => max / k <= 5) || Math.ceil(max / 5);
const vrh = Math.ceil(max / korak) * korak;
const X = (i) => L + (i * sirina) / (dani.length - 1);
const Y = (n) => T + visina - (n * visina) / vrh;
const P = dani.map((x, i) => [X(i), Y(x.n)]);
const iVrh = dani.reduce((b, x, i) => (x.n > dani[b].n ? i : b), 0);

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
const linija = krivulja(P);
const dno = (T + visina).toFixed(1);
const povrsina = `${linija} L${P[P.length - 1][0].toFixed(1)},${dno} L${P[0][0].toFixed(1)},${dno} Z`;

const LJUBICASTA = '#7C3AED', CIJAN = '#22D3EE', TOCKA = '#E6EDF3', POZADINA = '#0D1117', MREZA = '#1F2335', TIHO = '#8B949E';
const CRTANJE = 2.2;                     // sekunde dok se linija nacrta
const korakTocke = CRTANJE / dani.length;
const yOznake = [];
for (let v = 0; v <= vrh; v += korak) yOznake.push(v);

// zaglavlje: tri „značke" desno
const znacke = [
  [`${ukupno}`, 'contributions'],
  [`${niz}`, niz === 1 ? 'day streak' : 'day streak'],
  [`${danas}`, 'today'],
];
let zx = W - R;
const znackeSvg = znacke.slice().reverse().map(([broj, opis], k) => {
  const w = 30 + broj.length * 8.6 + opis.length * 7.4;
  zx -= w;
  const x = zx;
  zx -= 10;
  return `<g class="znacka" style="animation-delay:${(0.15 * (2 - k)).toFixed(2)}s">
    <rect x="${x.toFixed(1)}" y="20" width="${w.toFixed(1)}" height="30" rx="15" fill="#161B22" stroke="#30363D"/>
    <text x="${(x + 13).toFixed(1)}" y="40" font-size="14"><tspan fill="url(#potez)" font-weight="700">${broj}</tspan><tspan fill="${TIHO}" dx="5">${opis}</tspan></text>
  </g>`;
}).join('\n  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Ubuntu, sans-serif">
  <title>${korisnik}: ${ukupno} contributions in the last ${DANA} days (${dani[0].d} – ${dani[dani.length - 1].d})</title>
  <defs>
    <linearGradient id="potez" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${LJUBICASTA}"/><stop offset="1" stop-color="${CIJAN}"/>
    </linearGradient>
    <linearGradient id="sjaj" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${LJUBICASTA}" stop-opacity="0.45"/>
      <stop offset="0.6" stop-color="${CIJAN}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${CIJAN}" stop-opacity="0"/>
    </linearGradient>
    <filter id="blur" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <style>
    .crta { stroke-dasharray: 1; stroke-dashoffset: 1; animation: crtaj ${CRTANJE}s linear forwards; }
    .povrsina { opacity: 0; animation: pojavi .9s ease-out ${(CRTANJE * 0.55).toFixed(2)}s forwards; }
    .tocka { transform-box: fill-box; transform-origin: center; transform: scale(0); animation: iskoci .35s cubic-bezier(.34,1.56,.64,1) forwards; }
    .vrh { opacity: 0; animation: pojavi .5s ease-out ${(CRTANJE + 0.2).toFixed(2)}s forwards; }
    .danas { transform-box: fill-box; transform-origin: center; animation: puls 1.8s ease-in-out ${(CRTANJE + 0.4).toFixed(2)}s infinite; opacity: 0; }
    .znacka { opacity: 0; animation: pojavi .6s ease-out forwards; }
    @keyframes crtaj { to { stroke-dashoffset: 0; } }
    @keyframes pojavi { to { opacity: 1; } }
    @keyframes iskoci { to { transform: scale(1); } }
    @keyframes puls { 0% { opacity: .7; transform: scale(1); } 100% { opacity: 0; transform: scale(3.2); } }
    @media (prefers-reduced-motion: reduce) {
      .crta, .povrsina, .tocka, .vrh, .znacka { animation: none; stroke-dashoffset: 0; opacity: 1; transform: none; }
      .danas { animation: none; }
    }
  </style>
  <rect width="${W}" height="${H}" fill="${POZADINA}" rx="10"/>
  <text x="${L - 30}" y="41" font-size="17" font-weight="700" fill="${TOCKA}">📈 Activity <tspan fill="${TIHO}" font-weight="400" font-size="13">· last ${DANA} days</tspan></text>
  ${znackeSvg}
  ${yOznake.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${MREZA}" stroke-width="1"/>
  <text x="${L - 10}" y="${(Y(v) + 4).toFixed(1)}" fill="${TIHO}" font-size="11" text-anchor="end">${v}</text>`).join('\n  ')}
  ${dani.map((x, i) => (i % 2 === 0 || i === dani.length - 1) ? `<text x="${X(i).toFixed(1)}" y="${T + visina + 20}" fill="${TIHO}" font-size="11" text-anchor="middle">${Number(x.d.slice(8))}</text>` : '').filter(Boolean).join('\n  ')}
  <path class="povrsina" d="${povrsina}" fill="url(#sjaj)"/>
  <path class="crta" d="${linija}" pathLength="1" fill="none" stroke="url(#potez)" stroke-width="6" stroke-linecap="round" opacity="0.55" filter="url(#blur)"/>
  <path class="crta" d="${linija}" pathLength="1" fill="none" stroke="url(#potez)" stroke-width="3" stroke-linecap="round"/>
  ${P.map(([x, y], i) => `<circle class="tocka" style="animation-delay:${(i * korakTocke).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === iVrh ? 5.5 : 3.5}" fill="${i === iVrh ? CIJAN : TOCKA}"><title>${dani[i].d}: ${dani[i].n}</title></circle>`).join('\n  ')}
  <circle class="danas" cx="${P[P.length - 1][0].toFixed(1)}" cy="${P[P.length - 1][1].toFixed(1)}" r="4" fill="none" stroke="${CIJAN}" stroke-width="2"/>
  <g class="vrh">
    <text x="${P[iVrh][0].toFixed(1)}" y="${(P[iVrh][1] - 14).toFixed(1)}" font-size="13" font-weight="700" fill="${TOCKA}" text-anchor="middle">🔥 ${dani[iVrh].n}</text>
  </g>
</svg>
`;
mkdirSync(dirname(izlaz), { recursive: true });
writeFileSync(izlaz, svg);
console.log(`✓ ${izlaz}: ${dani.length} dana (${dani[0].d} – ${dani[dani.length - 1].d}), zbroj ${ukupno}, najviše ${max}, niz ${niz}, danas ${danas} · iz kalendara pročitano ${sve.length} dana`);
