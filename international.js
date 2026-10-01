"use strict";

const state = { records: [], by_source: {}, by_class: {} };
const $ = (id) => document.getElementById(id);

function fmtBytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function primaryBadge(p) {
  const parts = [];
  if (p.archive.length) {
    const types = p.archive.map((a) => a.type.toUpperCase()).join("+");
    parts.push(`<span class="ok">archived ${types} (${fmtBytes(p.archive.reduce((s, a) => s + a.bytes, 0))})</span>`);
  } else {
    parts.push(`<span class="none">no archived doc</span>`);
  }
  if (p.text) {
    parts.push(`<span class="ok">text ${fmtBytes(p.text_chars)}</span>`);
  } else {
    parts.push(`<span class="none">no extracted text</span>`);
  }
  return parts.join(" · ");
}

function card(r) {
  const p = r.primary;
  const conf = r.confidence ? `<span class="badge">${r.confidence} conf</span>` : "";
  return `<div class="card intl-card">
    <h3>${r.name || r.id}</h3>
    <div class="src-line">
      <span class="src-pill">${r.source_title}</span>
      <span class="class-pill">${r.org_label}</span>
      ${r.reach ? `<span class="badge">${r.reach}</span>` : ""}
      ${conf}
    </div>
    ${r.issuer ? `<div class="meta"><span><b>Issuer:</b> ${r.issuer}</span></div>` : ""}
    <div class="primary"><b>Primary sources:</b> ${primaryBadge(p)}</div>
    ${r.evidence ? `<div class="evidence">${r.evidence}</div>` : ""}
  </div>`;
}

function render() {
  const q = ($("q").value || "").trim().toLowerCase();
  const src = $("source").value;
  const cls = $("orgclass").value;
  const pr = $("primary").value;
  const out = state.records.filter((r) => {
    if (src && r.source !== src) return false;
    if (cls && r.org_class !== cls) return false;
    if (pr) {
      const hasA = r.primary.archive.length > 0;
      const hasT = r.primary.text;
      if (pr === "both" && !(hasA && hasT)) return false;
      if (pr === "archive" && !hasA) return false;
      if (pr === "text" && !hasT) return false;
      if (pr === "none" && (hasA || hasT)) return false;
    }
    if (q) {
      const hay = [r.name, r.issuer, r.org_label, r.source_title].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  $("count").textContent = `${out.length} / ${state.records.length}`;
  $("grid").innerHTML = out.length ? out.map(card).join("") :
    '<p class="empty">No records match the current filters.</p>';
}

function renderSummary() {
  const n = state.records.length;
  const withBoth = state.records.filter((r) => r.primary.archive.length && r.primary.text).length;
  const withText = state.records.filter((r) => r.primary.text).length;
  const withArch = state.records.filter((r) => r.primary.archive.length).length;
  const srcs = Object.entries(state.by_source)
    .map(([s, v]) => `<span><b>${s}</b>: ${v.count}</span>`).join(" ");
  $("summary").innerHTML =
    `<b>${n}</b> international initiatives · <b>${withBoth}</b> with archive + text · ` +
    `<b>${withArch}</b> archived · <b>${withText}</b> with extracted text. ` +
    `<div class="stats">${srcs}</div>`;
}

function buildSelects() {
  const srcSel = $("source");
  for (const s of Object.keys(state.by_source).sort()) {
    const o = document.createElement("option");
    o.value = s; o.textContent = `${state.by_source[s].source_title || s} (${state.by_source[s].count})`;
    srcSel.appendChild(o);
  }
  const clsSel = $("orgclass");
  for (const c of Object.keys(state.by_class).sort()) {
    const o = document.createElement("option");
    o.value = c; o.textContent = `${c} (${state.by_class[c]})`;
    clsSel.appendChild(o);
  }
}

async function load() {
  try {
    const d = await (await fetch("data/international.json")).json();
    state.records = d.records;
    state.by_source = d.by_source;
    state.by_class = d.by_class;
  } catch (e) {
    $("grid").innerHTML =
      '<p class="empty">Could not load data/international.json — serve this folder over HTTP ' +
      '(e.g. <code>python -m http.server</code>), not as file:// — then reload.</p>';
    return;
  }
  buildSelects();
  renderSummary();
  render();
}

$("q").addEventListener("input", render);
for (const id of ["source", "orgclass", "primary"])
  $(id).addEventListener("change", render);

load();
