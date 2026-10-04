// The data the page is working with: cabinets, case files, each folder's evidence, the user's own file types,
// and the signed-in account. Everything is held in memory and is lost when the page reloads (see README).

// ---------- cabinets and case files ----------
// CM: every case file by title. Each has { cf, title, place, date, iso, status, upd, sum, long?, cab }.
const CM = {};
CASES.forEach((c) => {
  c.cab = 0;
  CM[c.title] = c;
});
// CABS: the cabinets, in order. Each case file belongs to one: its cab is an index into this list.
const CABS = [{ ...FIRST_CABINET }];
let curCab = 0; // the cabinet that is open
// The folders (see cabinet.js) of the case files kept in one cabinet.
const foldersIn = (cab) => drawer.folders.filter((f) => !f.isAdd && CM[f.label] && CM[f.label].cab === cab);
// Case numbers: each new case file takes the next one.
let cfSeq = CASE_NUMBER_START;
const nextCf = () => "CF-" + String(++cfSeq).padStart(4, "0");

// ---------- folders ----------
// SS: the working state of each folder that has been opened, by case title. A folder's state is
//   evidence: [{ id, type, date, title, summary, people, places, objects, notes?, src?, file?, edited? }]
//             summary is what the evidence shows (from the back end, or typed in with Edit);
//             notes is anything extra the user has written on it
//   xrefs:    cross-references between pieces of evidence
//   pins:     where each item was left on the pin board
//   sel:      the piece of evidence chosen on the Evidence tab     filter: the type the evidence grid is narrowed to
const SS = {};
// A folder's state. The first time a sample case is opened, its state is copied from the sample data.
function folderState(fo) {
  const c = CM[fo.label];
  if (!SS[fo.label])
    SS[fo.label] = {
      evidence: ((c && EVID[c.cf]) || []).map((e) => ({
        ...e,
        people: [...e.people],
        places: [...e.places],
        objects: [...e.objects],
      })),
      xrefs: ((c && XREF[c.cf]) || []).map((x) => ({ ...x })),
      pins: {},
      sel: null,
      filter: "all",
    };
  return SS[fo.label];
}
// The id for the next piece of evidence in a folder: "E1", "E2", ... skipping any already taken.
function nextEvidenceId(s) {
  let k = s.evidence.length + 1;
  while (s.evidence.some((e) => e.id === "E" + k)) k++;
  return "E" + k;
}

// ---------- file types ----------
// Types the user has added themselves, kept for next time: in this browser's storage where that is allowed,
// and in memory for the rest of the visit either way. They are kept per account.
let CUSTOM_TYPES = [];
const TYPE_MEM = {},
  typeKey = () => "caseCabinet.types." + (account || "guest");
function loadTypes() {
  let v = TYPE_MEM[typeKey()];
  try {
    const r = localStorage.getItem(typeKey());
    if (r) v = JSON.parse(r);
  } catch (e) {
    // storage is blocked here: the in-memory copy above still works
  }
  CUSTOM_TYPES = Array.isArray(v) ? v.filter((t) => t && typeof t.id === "string" && typeof t.label === "string") : [];
}
function saveTypes() {
  TYPE_MEM[typeKey()] = CUSTOM_TYPES;
  try {
    localStorage.setItem(typeKey(), JSON.stringify(CUSTOM_TYPES));
  } catch (e) {
    // storage is blocked here: the type is kept for this visit only
  }
}
// The label shown for a type id.
const typeLabel = (id) => {
  const c = CUSTOM_TYPES.find((t) => t.id === id);
  return c
    ? c.label
    : TYPE_LABEL[id] ||
        String(id || "other")
          .replace(/_/g, " ")
          .replace(/^./, (m) => m.toUpperCase());
};
// Every type on offer in a folder: the built-in ones, the user's own, and any already used by its evidence.
const allTypes = (s) => {
  const t = [...FILE_TYPES, ...CUSTOM_TYPES.map((x) => x.id)];
  s.evidence.forEach((e) => {
    if (!t.includes(e.type)) t.push(e.type);
  });
  return t;
};

// ---------- the case file being created ----------
// What has been typed on the left page of the new-case folder (see new-case.js).
let DRAFT = { name: "", place: "", sum: "" };

// ---------- accounts ----------
// Each email keeps its own cabinets and case files for as long as the page stays open.
// Creating an account always starts from the standing set: one cabinet. Signing in brings back what that email had.
const ACCOUNTS = {};
let account = null,
  wsVer = 0;
// Remember the signed-in account's cabinets and case files (called when the cabinet is locked).
function saveWorkspace() {
  if (!account) return;
  ACCOUNTS[account] = {
    cabs: CABS.map((c) => ({ ...c })),
    cur: curCab,
    seq: cfSeq,
    cases: drawer.folders.filter((f) => !f.isAdd).map((f) => ({ ...CM[f.label] })),
    ss: { ...SS },
  };
}
// Fill the drawer for an account: what it had before, or the standing set when it is new (fresh).
function loadWorkspace(email, fresh) {
  account = email;
  const w = fresh ? null : ACCOUNTS[email];
  drawer.folders.filter((f) => !f.isAdd).forEach((f) => f.el.remove());
  drawer.folders.splice(0, drawer.folders.length, ...drawer.folders.filter((f) => f.isAdd));
  [CM, SS].forEach((o) => Object.keys(o).forEach((k) => delete o[k]));
  CABS.length = 0;
  DRAFT = { name: "", place: "", sum: "" };
  Upload.clearStaged();
  if (w) {
    CABS.push(...w.cabs.map((c) => ({ ...c })));
    curCab = w.cur;
    cfSeq = w.seq;
    Object.assign(SS, w.ss);
    [...w.cases].reverse().forEach((c) => {
      CM[c.title] = { ...c };
      drawer.addFolder(c.title);
    });
  } else {
    CABS.push({ ...FIRST_CABINET });
    curCab = 0;
    cfSeq = CASE_NUMBER_START;
    CASES.forEach((c) => {
      CM[c.title] = { ...c, cab: 0 };
      drawer.addFolder(c.title);
    });
  }
  loadTypes();
  wsVer++; // tells the drawer view its files have been replaced
}
