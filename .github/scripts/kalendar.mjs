// Javni kalendar doprinosa → [{ datum, broj, razina, tjedan, dan }] — JEDINO mjesto koje ga čita
// (graf aktivnosti i „sokrat.dev" ga dijele). Bez tokena: https://github.com/users/<korisnik>/contributions.
//
// Ćelija:  <td data-date="2026-10-10" id="contribution-day-component-6-51" data-level="4" …>
//          (id = …-<dan u tjednu 0–6>-<tjedan 0–52>)
// Broj:    <tool-tip for="contribution-day-component-6-51">94 contributions on October 10th.</tool-tip>
// Pada GLASNO ako stranica ne izgleda kako očekuje — tada workflow ne objavi ništa i ostaje zadnja dobra slika.

// Svaka greška kao GitHub anotacija (`::error::`) — anotacije su javne, logovi traže admin prava.
export function prijavi(e) {
  console.log('::error::' + String((e && (e.stack || e.message)) || e).replace(/\r?\n/g, '%0A'));
  process.exit(1);
}
process.on('uncaughtException', prijavi);
process.on('unhandledRejection', prijavi);

export async function kalendar(korisnik) {
  const res = await fetch(`https://github.com/users/${korisnik}/contributions`, { headers: { 'User-Agent': 'contribution-art' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} za kalendar doprinosa`);
  const html = await res.text();
  const celije = new Map();
  for (const m of html.matchAll(/<td\b[^>]*>/g)) {
    const t = m[0];
    const datum = /data-date="(\d{4}-\d{2}-\d{2})"/.exec(t);
    const id = /\bid="(contribution-day-component-(\d)-(\d+))"/.exec(t);
    if (!datum || !id) continue;
    const razina = /data-level="(\d)"/.exec(t);
    celije.set(id[1], { datum: datum[1], broj: 0, razina: razina ? Number(razina[1]) : 0, dan: Number(id[2]), tjedan: Number(id[3]) });
  }
  let brojki = 0;
  for (const m of html.matchAll(/<tool-tip[^>]*?\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const c = celije.get(m[1]);
    if (!c) continue;
    const n = /^(\d+) contributions?/.exec(m[2].trim());   // „No contributions on …" = 0
    c.broj = n ? Number(n[1]) : 0;
    brojki++;
  }
  if (celije.size < 300 || brojki < 300) {
    throw new Error(`Kalendar ne izgleda kako treba: ${celije.size} dana, ${brojki} brojki (očekivano ≥ 300); HTTP ${res.status}, ${html.length} B`);
  }
  return [...celije.values()].sort((a, b) => a.datum.localeCompare(b.datum));
}
