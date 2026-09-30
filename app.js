"use strict";

const state = { sources: [], bundles: {}, current: null, instruments: [],
                overlap: null, mode: "source" };

const $ = (id) => document.getElementById(id);

async function load() {
  try {
    const idx = await (await fetch("data/index.json")).json();
    state.sources = idx.sources;
  } catch (e) {
    $("sourcetabs").innerHTML =
      '<p class="empty">Could not load data/index.json — serve this folder over HTTP ' +
      '(e.g. <code>python -m http.server</code>), not as file:// — then reload.</p>';
    return;
  }
  try { state.overlap = await (await fetch("data/overlap.json")).json(); }
  catch (e) { state.overlap = null; }
  renderTabs();
  renderSummary();
  if (state.sources.length) await selectSource(state.sources[0].db);
}

function renderTabs() {
  const nav = $("sourcetabs");
  nav.innerHTML = "";
  for (const s of state.sources) {
    const b = document.createElement("button");
    b.dataset.db = s.db;
    b.innerHTML = `${s.title.split("—")[0].trim()} <span class="n">(${s.count})</span>`;
    b.onclick = () => { state.mode = "source"; renderOverTabs(); selectSource(s.db); };
    nav.appendChild(b);
  }
  const ov = document.createElement("button");
  if (state.overlap) {
    ov.innerHTML = `<b>Overlaps</b> <span class="n">(${state.overlap.summary.cluster_count})</span>`;
  } else {
    ov.innerHTML = "Overlaps";
    ov.disabled = true;
  }
  ov.onclick = enterOverlap;
  $("overtabs").innerHTML = "";
  $("overtabs").appendChild(ov);
}

function renderOverTabs() {
  const isOver = state.mode === "overlap";
  [...document.querySelectorAll("#overtabs button")].forEach((b) =>
    b.classList.toggle("active", isOver));
}

function renderSummary() {
  const total = state.sources.reduce((a, s) => a + s.count, 0);
  $("summary").innerHTML =
    `<b>${state.sources.length}</b> sources · <b>${total.toLocaleString()}</b> initiative records, ` +
    `each with mapped metadata, classification and review status.`;
}

async function selectSource(db) {
  state.mode = "source";
  renderOverTabs();
  [...document.querySelectorAll("#sourcetabs button")].forEach((t) =>
    t.classList.toggle("active", t.dataset.db === db));
  state.current = db;
  if (!state.bundles[db]) {
    try { state.bundles[db] = await (await fetch(`data/${db}.json`)).json(); }
    catch (e) { state.bundles[db] = { instruments: [] }; }
  }
  state.instruments = state.bundles[db].instruments;
  $("controls").hidden = false;
  $("ovcontrols").hidden = true;
  $("overview").innerHTML = "";
  rebuildYearOptions();
  render();
}

// ---------------- source mode ----------------
function rebuildYearOptions() {
  const sel = $("year");
  const cur = sel.value;
  const years = [...new Set(state.instruments.map((i) => i.year).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Year: all</option>' +
    years.map((y) => `<option value="${y}">${y}</option>`).join("");
  sel.value = cur;
}

function badge(cls, review) {
  const clean = (s) => s.replace(/[^a-z]/g, "");
  const classes = cls === "unclassified" ? "unknown" : clean(cls);
  return `<span class="badge ${classes}">${cls.toUpperCase()}</span>` +
    (review === "matched"
      ? '<span class="badge matched">in corpus</span>'
      : review !== "none" && review !== "matched"
        ? `<span class="badge">${review}</span>`
        : "");
}

function card(i) {
  const link = i.link ? `<a href="${i.link}" target="_blank" rel="noopener">${i.name || i.id}</a>` : (i.name || i.id);
  const meta = [
    ["Issuer", i.issuer], ["Country", i.country], ["Region", i.region],
    ["Year", i.year], ["Type", i.type], ["Binding", i.binding], ["Sector", i.sector],
  ].filter(([k, v]) => v).map(([k, v]) => `<span><b>${k}:</b> ${v}</span>`).join("");
  return `<div class="card">
    <h3>${link}</h3>
    ${meta ? `<div class="meta">${meta}</div>` : ""}
    ${i.summary ? `<p class="desc">${i.summary}</p>` : ""}
    <div class="badges">${badge(i.classification, i.review)}</div>
  </div>`;
}

function render() {
  const q = ($("q").value || "").trim().toLowerCase();
  const cls = $("classification").value;
  const rev = $("review").value;
  const yr = $("year").value;
  const out = state.instruments.filter((i) => {
    if (cls && i.classification !== cls) return false;
    if (rev && i.review !== rev) return false;
    if (yr && i.year !== yr) return false;
    if (q) {
      const hay = [i.name, i.issuer, i.country, i.region, i.type, i.sector].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  $("count").textContent = `${out.length} / ${state.instruments.length}`;
  $("grid").innerHTML = out.length ? out.map(card).join("") :
    '<p class="empty">No records match the current filters.</p>';
}

// ---------------- overlap mode ----------------
function enterOverlap() {
  if (!state.overlap) return;
  state.mode = "overlap";
  renderOverTabs();
  [...document.querySelectorAll("#sourcetabs button")].forEach((t) => t.classList.remove("active"));
  $("controls").hidden = true;
  $("ovcontrols").hidden = false;
  renderOverview();
  renderOverlaps();
}

function renderOverview() {
  const s = state.overlap.summary;
  const bysrc = Object.entries(s.by_source)
    .map(([db, v]) => `<span><b>${db}</b>: ${v.in_overlap}/${v.total}</span>`).join(" ");
  const pm = state.overlap.pair_matrix;
  const all = Object.keys(pm).flatMap((k) => k.split("|"));
  const srcs = [...new Set(all)].sort();
  let matrix = "";
  if (srcs.length) {
    const head = `<tr><th></th>${srcs.map((x) => `<th>${x.split("-")[0]}</th>`).join("")}</tr>`;
    const body = srcs.map((a) =>
      `<tr><th>${a.split("-")[0]}</th>` +
      srcs.map((b) => `<td>${pm[`${a}|${b}`] || pm[`${b}|${a}`] || ""}</td>`).join("") +
      `</tr>`).join("");
    matrix = `<h3>Shared instruments between source pairs</h3><table class="matrix">${head}${body}</table>`;
  }
  $("overview").innerHTML =
    `<h2>Cross-source overlap</h2>
     <div class="stats">
       <span><b>${s.cluster_count}</b> instruments appear in ≥2 sources</span>
       <span><b>${s.duplicate_records}</b> of ${state.overlap.record_count} records duplicate an identical instrument in another source</span>
       <span><b>${Math.round(s.dedup_ratio * 100)}%</b> of the union is duplicate</span>
       <span><b>${s.unique_records}</b> records are unique to one source</span>
     </div>
     <div class="stats">${bysrc}</div>
     ${matrix || ""}`;
}

function clusterCard(c) {
  const pills = Object.entries(c.source_distribution)
    .map(([s, n]) => `<span class="src-pill">${s}${n > 1 ? " ×" + n : ""}</span>`).join(" ");
  const members = c.members.map((m) =>
    `<div class="member"><span class="src">${m.source}</span> — ${m.name}</div>`).join(" ");
  return `<div class="cluster">
    <h3>${c.name}</h3>
    <div class="srcs">${pills}<span>${c.instrument_count} record${c.instrument_count > 1 ? "s" : ""} · ${c.source_count} sources</span></div>
    <details><summary>See the matching records</summary><div class="members">${members}</div></details>
  </div>`;
}

function renderOverlaps() {
  const q = ($("oq").value || "").trim().toLowerCase();
  const min = parseInt($("minsrc").value || "2", 10);
  const out = state.overlap.clusters.filter((c) => {
    if (c.source_count < min) return false;
    if (q) {
      const hay = (c.name + " " + c.members.map((m) => m.source).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  $("ocount").textContent = `${out.length} / ${state.overlap.clusters.length}`;
  $("grid").innerHTML = out.length ? out.map(clusterCard).join("") :
    `<p class="empty">No overlapping instruments match.</p>`;
}

$("q").addEventListener("input", render);
$("oq").addEventListener("input", renderOverlaps);
for (const id of ["classification", "review", "year"])
  $(id).addEventListener("change", render);
$("minsrc").addEventListener("change", renderOverlaps);

load();