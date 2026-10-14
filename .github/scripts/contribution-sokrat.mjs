// „sokrat.dev" na grafu doprinosa: slova dolaze slijeva nadesno jedno po jedno, bljesnu kao LED križ ljekarne,
// pa se raspadnu u PRAVI graf doprinosa (svaki dan s doprinosom = jedna kockica), i sve se ponavlja.
// Pokreni: node .github/scripts/contribution-sokrat.mjs <korisnik> <izlaz-svijetli.svg> <izlaz-tamni.svg>
//
// Mreža je ista kao graf (tjedni × 7 dana). Kockica teksta i dan grafa spajaju se redom slijeva nadesno; ako
// dana ima više nego kockica, neke se kockice dijele (i obrnuto), pa nijedna ne ostane bez para. Animacija je
// CSS unutar SVG-a (GitHub u <img> ne pušta skripte); „smanji animacije" u sustavu = samo mirni tekst.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { kalendar } from './kalendar.mjs';

const [korisnik = 'leonkreso784-bit', izlazSvijetli = 'dist/github-sokrat.svg', izlazTamni = 'dist/github-sokrat-dark.svg'] = process.argv.slice(2);
const celije = await kalendar(korisnik);
const dani = celije.filter((c) => c.broj > 0).sort((a, b) => a.tjedan - b.tjedan || a.dan - b.dan);

// ── pixel font: 7 redaka (mala slova, k/t/d imaju uzlaznu crtu), # = upaljeno ──
const FONT = {
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.'],
  o: ['....', '....', '.##.', '#..#', '#..#', '#..#', '.##.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  r: ['....', '....', '#.##', '##..', '#...', '#...', '#...'],
  a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###'],
  t: ['.#.', '.#.', '###', '.#.', '.#.', '.#.', '..#'],
  '.': ['..', '..', '..', '..', '..', '##', '##'],
  d: ['...#', '...#', '.###', '#..#', '#..#', '#..#', '.###'],
  e: ['....', '....', '.##.', '#..#', '####', '#...', '.###'],
  v: ['.....', '.....', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
};
const TEKST = 'sokrat.dev';
const tjedana = Math.max(...celije.map((c) => c.tjedan)) + 1;
const sirina = [...TEKST].reduce((s, z) => s + FONT[z][0].length, 0) + TEKST.length - 1;
let stupac = Math.floor((tjedana - sirina) / 2);
const pikseli = [];
[...TEKST].forEach((z, slovo) => {
  FONT[z].forEach((red, dan) => [...red].forEach((znak, i) => { if (znak === '#') pikseli.push({ tjedan: stupac + i, dan, slovo }); }));
  stupac += FONT[z][0].length + 1;
});
pikseli.sort((a, b) => a.tjedan - b.tjedan || a.dan - b.dan);
const prviStupac = pikseli[0].tjedan;

// kockica k: polazi s piksela teksta, završava na danu grafa (bez doprinosa ostaje na mjestu i samo nestane)
const N = Math.max(pikseli.length, dani.length);
const kockice = Array.from({ length: N }, (_, k) => ({
  od: pikseli[Math.floor((k * pikseli.length) / N)],
  do: dani.length ? dani[Math.floor((k * dani.length) / N)] : null,
}));

// ── vrijeme (sekunde) ──
const SLOVO_KORAK = 0.25, SLOVO_TRAJE = 0.35;
const BLJESAK = (TEKST.length - 1) * SLOVO_KORAK + SLOVO_TRAJE + 0.5;
const TREPTAJI = [0, 1, 2].map((i) => BLJESAK + i * 0.24); // svaki: 0,12 s ugašeno pa upaljeno
const VAL = BLJESAK + 0.85, VAL_TRAJE = 0.55, VAL_SVIJETLO = 0.15;
const PULSEVI = [VAL + VAL_TRAJE + 0.35, VAL + VAL_TRAJE + 0.65];
const RASPAD = PULSEVI[1] + 0.8, RASPAD_RASIPANJE = 1.4, LET = 1.0;
const NESTANAK = RASPAD + RASPAD_RASIPANJE + LET + 3.5, NESTANAK_TRAJE = 0.8;
const CIKLUS = NESTANAK + NESTANAK_TRAJE + 0.3;
const E = 0.01; // „odmah" — dvije točke tako blizu da prijelaz izgleda kao prekidač
const pct = (s) => ((100 * Math.min(Math.max(s, 0), CIKLUS)) / CIKLUS).toFixed(3) + '%';
const keyframes = (ime, tocke) => `@keyframes ${ime}{${tocke.map(([s, css]) => `${pct(s)}{${css}}`).join('')}}`;

// ── crtanje ──
const C = 11, R = 3, POLJE = C + R, LIJEVO = 4, GORE = 4;
const W = LIJEVO * 2 + tjedana * POLJE - R, H = GORE * 2 + 7 * POLJE - R;
const x = (t) => LIJEVO + t * POLJE, y = (d) => GORE + d * POLJE;
const nasumicno = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); }; // isto svake noći

function svg(boje) {
  const pozadina = celije.map((c) => `<rect x="${x(c.tjedan)}" y="${y(c.dan)}" width="${C}" height="${C}" rx="2" fill="${boje.prazno}"/>`).join('');
  const kf = [];

  // treptaji i nestanak — cijeli tekst odjednom
  kf.push(keyframes('sve', [
    [0, 'opacity:1'],
    ...TREPTAJI.flatMap((t) => [[t, 'opacity:1'], [t + E, 'opacity:0'], [t + 0.12, 'opacity:0'], [t + 0.12 + E, 'opacity:1']]),
    [NESTANAK, 'opacity:1'], [NESTANAK + NESTANAK_TRAJE, 'opacity:0'], [CIKLUS, 'opacity:0'],
  ]));

  // slova: kratko klizanje slijeva, jedno za drugim
  const grupe = [...TEKST].map((_, n) => {
    const t = n * SLOVO_KORAK, skriveno = `opacity:0;transform:translateX(-${3 * POLJE}px)`, mjesto = 'opacity:1;transform:translateX(0)';
    kf.push(keyframes(`s${n}`, [[0, skriveno], [t, skriveno + ';animation-timing-function:cubic-bezier(.2,.8,.2,1)'], [t + SLOVO_TRAJE, mjesto], [CIKLUS, mjesto]]));
    return [];
  });

  kockice.forEach((k, i) => {
    const { od } = k, cilj = k.do;
    const nivo = cilj ? boje.razine[Math.max(1, Math.min(4, cilj.razina)) - 1] : boje.tekst;
    // val bljeska ide stupac po stupac; raspad kreće slijeva, uz malo slučajnosti da izgleda kao mrvljenje
    const val = VAL + ((od.tjedan - prviStupac) / sirina) * VAL_TRAJE;
    const kreni = RASPAD + ((od.tjedan - prviStupac) / sirina) * (RASPAD_RASIPANJE - 0.4) + nasumicno(i) * 0.4;
    kf.push(keyframes(`b${i}`, [
      [0, `fill:${boje.tekst}`],
      [val, `fill:${boje.tekst}`], [val + 0.04, `fill:${boje.bljesak}`], [val + VAL_SVIJETLO, `fill:${boje.tekst}`],
      ...PULSEVI.flatMap((p) => [[p, `fill:${boje.tekst}`], [p + 0.02, `fill:${boje.bljesak}`], [p + 0.1, `fill:${boje.bljesak}`], [p + 0.14, `fill:${boje.tekst}`]]),
      [kreni, `fill:${boje.tekst}`], [kreni + LET, `fill:${nivo}`], [CIKLUS, `fill:${nivo}`],
    ]));
    const dx = cilj ? x(cilj.tjedan) - x(od.tjedan) : 0, dy = cilj ? y(cilj.dan) - y(od.dan) : 0;
    const sx = (0.5 * dx + (nasumicno(i + 0.5) - 0.5) * 4 * POLJE).toFixed(1), sy = (0.5 * dy - (1 + nasumicno(i + 0.25) * 2) * POLJE).toFixed(1);
    kf.push(keyframes(`m${i}`, [
      [0, 'transform:translate(0,0)'],
      [kreni, 'transform:translate(0,0);animation-timing-function:cubic-bezier(.3,.6,.5,1)'],
      [kreni + LET * 0.45, `transform:translate(${sx}px,${sy}px);animation-timing-function:cubic-bezier(.5,0,.7,.4)`],
      [kreni + LET, `transform:translate(${dx}px,${dy}px)`], [CIKLUS, `transform:translate(${dx}px,${dy}px)`],
    ]));
    grupe[od.slovo].push(`<g style="animation:m${i} ${CIKLUS.toFixed(2)}s infinite"><rect x="${x(od.tjedan)}" y="${y(od.dan)}" width="${C}" height="${C}" rx="2" fill="${boje.tekst}" style="animation:b${i} ${CIKLUS.toFixed(2)}s infinite"/></g>`);
  });

  const slova = grupe.map((g, n) => `<g style="animation:s${n} ${CIKLUS.toFixed(2)}s infinite">${g.join('')}</g>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>${TEKST} → ${korisnik}: contribution graph (${dani.length} active days)</title>
<style>${kf.join('')}@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>
${pozadina}
<g style="animation:sve ${CIKLUS.toFixed(2)}s infinite">
${slova}
</g>
</svg>
`;
}

const SVIJETLO = { prazno: '#EBEDF0', tekst: '#1E3A8A', bljesak: '#60A5FA', razine: ['#BFDBFE', '#60A5FA', '#2563EB', '#1E3A8A'] };
const TAMNO = { prazno: '#161B22', tekst: '#1E40AF', bljesak: '#93C5FD', razine: ['#172554', '#1E3A8A', '#1D4ED8', '#3B82F6'] };
for (const [izlaz, boje] of [[izlazSvijetli, SVIJETLO], [izlazTamni, TAMNO]]) {
  mkdirSync(dirname(izlaz), { recursive: true });
  writeFileSync(izlaz, svg(boje));
}
console.log(`✓ ${TEKST}: ${pikseli.length} kockica teksta → ${dani.length} aktivnih dana (${N} kockica), ciklus ${CIKLUS.toFixed(1)} s · ${izlazSvijetli}, ${izlazTamni}`);
