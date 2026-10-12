// „Contribution Tetris": tetris komadi uliječu slijeva i slažu PRAVI graf doprinosa, pa se sve ponavlja.
// Pokreni: node .github/scripts/contribution-tetris.mjs <korisnik> <izlaz-svijetli.svg> <izlaz-tamni.svg>
//
// Dani s doprinosima režu se u komade od najviše 4 polja (rubna polja zna ostati manji komad); komad od 4
// dobiva boju svog tetris oblika (I O T S Z J L), manji svoju. Svjetlina bloka = GitHubova razina dana
// (1–4), pa se graf i dalje čita. Animacija je CSS unutar SVG-a (GitHub u <img> ne pušta skripte);
// „smanji animacije" u sustavu = odmah gotova slika.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { kalendar } from './kalendar.mjs';

const [korisnik = 'leonkreso784-bit', izlazSvijetli = 'dist/github-tetris.svg', izlazTamni = 'dist/github-tetris-dark.svg'] = process.argv.slice(2);
const celije = await kalendar(korisnik);

// ── komadi ──
const kljuc = (t, d) => t + ',' + d;
const pune = new Map(celije.filter((c) => c.broj > 0).map((c) => [kljuc(c.tjedan, c.dan), c]));
const uzeto = new Set();
const redom = [...pune.values()].sort((a, b) => a.tjedan - b.tjedan || a.dan - b.dan);
const komadi = [];
for (const c of redom) {
  if (uzeto.has(kljuc(c.tjedan, c.dan))) continue;
  const komad = [c];
  uzeto.add(kljuc(c.tjedan, c.dan));
  while (komad.length < 4) {
    // susjed koji je najviše lijevo pa gore — komad raste prema neuzetim danima
    let najbolji = null;
    for (const k of komad) {
      for (const [dt, dd] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const s = pune.get(kljuc(k.tjedan + dt, k.dan + dd));
        if (!s || uzeto.has(kljuc(s.tjedan, s.dan))) continue;
        if (!najbolji || s.tjedan < najbolji.tjedan || (s.tjedan === najbolji.tjedan && s.dan < najbolji.dan)) najbolji = s;
      }
    }
    if (!najbolji) break;
    komad.push(najbolji);
    uzeto.add(kljuc(najbolji.tjedan, najbolji.dan));
  }
  komadi.push(komad);
}

// oblik komada od 4 → tetromino (samo rotacije: S≠Z, J≠L)
const OBLICI = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};
const normaliziraj = (p) => {
  const mx = Math.min(...p.map((q) => q[0])), my = Math.min(...p.map((q) => q[1]));
  return p.map(([x, y]) => [x - mx, y - my]).map((q) => q.join(':')).sort().join('|');
};
const TIP = new Map();
for (const [ime, p] of Object.entries(OBLICI)) {
  let r = p;
  for (let i = 0; i < 4; i++) { TIP.set(normaliziraj(r), ime); r = r.map(([x, y]) => [y, -x]); }
}
const BOJA = { I: '#22D3EE', O: '#FACC15', T: '#A855F7', S: '#22C55E', Z: '#EF4444', J: '#3B82F6', L: '#F97316' };
const tipKomada = (k) => (k.length === 4 ? TIP.get(normaliziraj(k.map((c) => [c.tjedan, c.dan]))) : String(k.length));

// ── crtanje ──
const C = 11, R = 3, POLJE = C + R, LIJEVO = 4, GORE = 4;
const tjedana = Math.max(...celije.map((c) => c.tjedan)) + 1;
const W = LIJEVO * 2 + tjedana * POLJE - R, H = GORE * 2 + 7 * POLJE - R;
const KORAK = Math.min(0.22, 12 / Math.max(1, komadi.length)); // gradnja traje najviše ~12 s
const DOLAZAK = 0.5, ZASTOJ = 3, NESTANAK = 1;
const CIKLUS = komadi.length * KORAK + DOLAZAK + ZASTOJ + NESTANAK;
const pct = (s) => ((100 * s) / CIKLUS).toFixed(3) + '%';
const x = (t) => LIJEVO + t * POLJE, y = (d) => GORE + d * POLJE;

function svg(prazno) {
  const pozadina = celije.map((c) => `<rect x="${x(c.tjedan)}" y="${y(c.dan)}" width="${C}" height="${C}" rx="2" fill="${prazno}"/>`).join('');
  const kf = [], grupe = [];
  komadi.forEach((k, i) => {
    const pocetak = i * KORAK, kraj = pocetak + DOLAZAK, blijedi = CIKLUS - NESTANAK;
    kf.push(`@keyframes k${i}{0%,${pct(pocetak)}{opacity:0;transform:translateX(-${(x(Math.min(...k.map((c) => c.tjedan))) + 4 * POLJE).toFixed(0)}px);animation-timing-function:cubic-bezier(.2,.8,.2,1)}${pct(kraj)},${pct(blijedi)}{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(0)}}`);
    // manji od 4 nije tetromino — dobiva tetris boje redom, da slika ostane šarena
    const tip = tipKomada(k);
    const boja = BOJA[tip] && tip.length === 1 && isNaN(Number(tip)) ? BOJA[tip] : 'IOTSZJL'.split('').map((t) => BOJA[t])[i % 7];
    const blokovi = k.map((c) => `<rect x="${x(c.tjedan)}" y="${y(c.dan)}" width="${C}" height="${C}" rx="2" fill="${boja}" fill-opacity="${(0.55 + 0.15 * Math.max(0, c.razina - 1)).toFixed(2)}" stroke="${boja}" stroke-width="1"/>`).join('');
    grupe.push(`<g style="animation:k${i} ${CIKLUS.toFixed(2)}s infinite">${blokovi}</g>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>${korisnik}: contribution tetris (${komadi.length} pieces, ${pune.size} active days)</title>
<style>${kf.join('')}@media (prefers-reduced-motion: reduce){g{animation:none!important;opacity:1}}</style>
${pozadina}
${grupe.join('\n')}
</svg>
`;
}

for (const [izlaz, prazno] of [[izlazSvijetli, '#EBEDF0'], [izlazTamni, '#161B22']]) {
  mkdirSync(dirname(izlaz), { recursive: true });
  writeFileSync(izlaz, svg(prazno));
}
const poTipu = {};
komadi.forEach((k) => { const t = tipKomada(k); poTipu[t] = (poTipu[t] || 0) + 1; });
console.log(`✓ tetris: ${pune.size} aktivnih dana → ${komadi.length} komada ${JSON.stringify(poTipu)}, ciklus ${CIKLUS.toFixed(1)} s · ${izlazSvijetli}, ${izlazTamni}`);
