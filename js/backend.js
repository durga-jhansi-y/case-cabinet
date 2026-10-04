// Stand-ins for the server. There is no back end yet, so these two functions do in the browser what a server
// would do. They are the only two to replace when it exists: keep what each one takes and returns, and the rest of
// the page does not need to change.

// ---------- review: what type is each uploaded file? ----------
// Takes the chosen File objects. Returns a promise of [{ name, type }] in the same order, where type is one of
// FILE_TYPES (config.js). Each result may also carry that file's analysis: { summary, people, places, objects }.
// Whatever is returned is shown on the Evidence tab and feeds the pin board.
// THE STAND-IN waits a moment, then guesses the type from the file's name and kind. It returns no analysis.
function reviewFiles(files) {
  const guess = (f) => {
    const n = f.name.toLowerCase(),
      t = f.type || "";
    if (/witness|statement|interview|testimon|affidavit/.test(n)) return "witness_statement";
    if (/suspect|mugshot|profile|record|background|alias/.test(n)) return "suspect_information";
    if (/timeline|chronolog|schedule|calendar|log\b|log[_.-]/.test(n)) return "timeline_event";
    if (/map|location|address|gps|route|floor.?plan/.test(n) || /\.(kml|gpx|geojson)$/.test(n))
      return "location_information";
    if (/osint|web|screenshot|social|tweet|post|profile.?page|whois/.test(n) || /\.(html?|url|webloc|mhtml)$/.test(n))
      return "web_osint";
    if (
      /email|e-mail|letter|message|chat|sms|text|call|voicemail|correspond/.test(n) ||
      /\.(eml|msg|mbox)$/.test(n) ||
      t.startsWith("audio/")
    )
      return "communication";
    if (
      /scene|evidence|exhibit|photo|cctv|footage|forensic|img|dsc/.test(n) ||
      t.startsWith("image/") ||
      t.startsWith("video/")
    )
      return "crime_scene_evidence";
    return "other";
  };
  const wait = reducedMotion() ? 300 : Math.min(2200, 900 + files.length * 140);
  return new Promise((res) => setTimeout(() => res(files.map((f) => ({ name: f.name, type: guess(f) }))), wait));
}

// ---------- connections: how is everything in a case related? ----------
// Takes a case's evidence and cross-references. Returns { nodes, links } for the pin board:
//   nodes: every person, place and object named in the evidence   { id, type, label, evidence: [ids] }
//   links: two nodes that appear in the same piece of evidence, or are tied by a cross-reference
//          { key, source, target, evidence: [ids], xrefs: [...] }   (each link keeps the evidence behind it)
function connections(evidence, xrefs) {
  const nodes = new Map(),
    links = new Map(),
    byLabel = new Map();
  const node = (label, type, eid) => {
    const id = type + ":" + label.toLowerCase();
    let n = nodes.get(id);
    if (!n) {
      n = { id, type, label, evidence: [] };
      nodes.set(id, n);
      byLabel.set(label.toLowerCase(), n);
    }
    if (eid && !n.evidence.includes(eid)) n.evidence.push(eid);
    return n;
  };
  const link = (a, b) => {
    const k = [a.id, b.id].sort().join("|");
    let l = links.get(k);
    if (!l) {
      l = { key: k, source: a.id, target: b.id, evidence: [], xrefs: [] };
      links.set(k, l);
    }
    return l;
  };
  evidence.forEach((e) => {
    const ns = [
      ...e.people.map((x) => node(x, "person", e.id)),
      ...e.places.map((x) => node(x, "place", e.id)),
      ...e.objects.map((x) => node(x, "object", e.id)),
    ];
    for (let i = 0; i < ns.length; i++)
      for (let j = i + 1; j < ns.length; j++) {
        if (ns[i] === ns[j]) continue;
        const l = link(ns[i], ns[j]);
        if (!l.evidence.includes(e.id)) l.evidence.push(e.id);
      }
  });
  xrefs.forEach((x) => {
    const a = byLabel.get(x.a.toLowerCase()),
      b = byLabel.get(x.b.toLowerCase());
    if (a && b && x.ev.every((id) => evidence.some((e) => e.id === id))) link(a, b).xrefs.push(x);
  });
  return { nodes: [...nodes.values()], links: [...links.values()] };
}
