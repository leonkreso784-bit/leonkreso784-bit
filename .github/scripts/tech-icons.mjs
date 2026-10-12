// Gradi „lebdeće" redove ikona tehnologija: assets/tech-languages.svg i assets/tech-tools.svg.
// Pokreni (kad se popis promijeni): node .github/scripts/tech-icons.mjs
//
// Zašto ugrađene ikone, a ne <img> sa skillicons.dev: GitHub sliku prikazuje kroz <img>, gdje SVG smije
// imati CSS animaciju, ali NE smije učitavati druge slike. Zato je svaka ikona ugrađena u isti SVG.
// Unutarnji id-evi dobivaju prefiks ikone, da se dvije ikone s istim id-em ne sudare.
// „Smanji animacije" u sustavu (prefers-reduced-motion) = ikone stoje mirno.

import { readFileSync, writeFileSync } from 'node:fs';

const REDOVI = {
  'assets/tech-languages.svg': ['rust', 'ts', 'js', 'py', 'postgres', 'html', 'css'],
  'assets/tech-tools.svg': ['react', 'svelte', 'nodejs', 'postgres', 'supabase', 'vercel', 'git', 'railway'],
};
const LOKALNE = { railway: 'assets/railway.svg' };   // skillicons ih nema
const KORAK = 300, IKONA = 256, GORE = 40, DOLJE = 56, VISINA_PX = 64;

async function ikona(ime) {
  let svg;
  if (LOKALNE[ime]) svg = readFileSync(LOKALNE[ime], 'utf8');
  else {
    const res = await fetch(`https://skillicons.dev/icons?i=${ime}`);
    if (!res.ok) throw new Error(`skillicons ${ime}: HTTP ${res.status}`);
    // jedna ikona = vanjski omotač + ugniježđeni <svg> 256×256 — uzima se ugniježđeni
    const t = await res.text();
    const m = /<g transform="translate\(0, 0\)">\s*([\s\S]*<\/svg>)\s*<\/g>/.exec(t);
    if (!m || !/<path|<rect|<circle|<polygon/.test(m[1])) throw new Error(`skillicons ${ime}: nema ikone (nepoznato ime?)`);
    svg = m[1];
  }
  svg = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[\s\S]*?<\/title>/g, '');
  // prefiks za id-eve i sve reference na njih
  return svg
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${ime}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${ime}-${id})`)
    .replace(/((?:xlink:)?href)="#([^"]+)"/g, (_, a, id) => `${a}="#${ime}-${id}"`)
    .trim();
}

for (const [izlaz, imena] of Object.entries(REDOVI)) {
  const dijelovi = [];
  for (const [i, ime] of imena.entries()) {
    let s = await ikona(ime);
    s = s.replace(/^<svg\b[^>]*>/, `<svg x="0" y="0" width="${IKONA}" height="${IKONA}" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">`);
    const kasni = (-i * 0.35).toFixed(2);
    dijelovi.push(`  <g transform="translate(${i * KORAK}, 0)">
    <ellipse class="sjena" cx="128" cy="${IKONA + 34}" rx="92" ry="11" style="animation-delay:${kasni}s"/>
    <g class="lebdi" style="animation-delay:${kasni}s">${s}</g>
  </g>`);
  }
  const sirina = imena.length * KORAK - (KORAK - IKONA);
  const visina = GORE + IKONA + DOLJE;
  const px = (VISINA_PX * sirina) / visina;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px.toFixed(1)}" height="${VISINA_PX}" viewBox="0 ${-GORE} ${sirina} ${visina}" fill="none">
  <title>${imena.join(', ')}</title>
  <style>
    .lebdi { animation: lebdi 3.2s ease-in-out infinite; }
    .sjena { fill: #000; opacity: .35; transform-box: fill-box; transform-origin: center; animation: sjena 3.2s ease-in-out infinite; }
    @keyframes lebdi { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-34px); } }
    @keyframes sjena { 0%, 100% { transform: scaleX(1); opacity: .35; } 50% { transform: scaleX(.7); opacity: .15; } }
    @media (prefers-reduced-motion: reduce) { .lebdi, .sjena { animation: none; } }
  </style>
${dijelovi.join('\n')}
</svg>
`;
  writeFileSync(izlaz, svg);
  console.log(`✓ ${izlaz}: ${imena.length} ikona (${imena.join(', ')}), ${svg.length} B`);
}
