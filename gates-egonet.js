"use strict";

const state = { data: null, network: null, nodes: null, edges: null };
const $ = (id) => document.getElementById(id);

const NODE_COLORS = {
  ego: { background: "#2f5bdf", border: "#1d3f9e", font: { color: "#fff" } },
  initiative: { background: "#0d8a4d", border: "#0a6b3c", font: { color: "#fff" } },
  actor: { background: "#eef2ff", border: "#c5d6ff", font: { color: "#1a2233" } },
};

const EDGE_COLORS = {
  funder: "#0d8a4d",
  supporter: "#2f9e6e",
  partner: "#2f5bdf",
  "co-host": "#6b4fe0",
  host: "#6b4fe0",
  lead: "#b98200",
  implementer: "#b98200",
  participant: "#8a8f9c",
  member: "#8a8f9c",
  coalition: "#8a8f9c",
};

function buildGraph() {
  const d = state.data;
  const nodes = d.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    color: NODE_COLORS[n.kind] || NODE_COLORS.actor,
    shape: n.kind === "ego" ? "star" : (n.kind === "initiative" ? "box" : "dot"),
    size: n.kind === "ego" ? 30 : (n.kind === "initiative" ? 22 : 14),
    font: { size: n.kind === "ego" ? 15 : 12 },
    title: n.label,
  }));
  const edges = d.edges.map((e) => ({
    from: e.source,
    to: e.target,
    label: e.type,
    color: { color: EDGE_COLORS[e.type] || "#8a8f9c", highlight: "#2f5bdf" },
    font: { size: 10, align: "middle" },
    width: e.type === "funder" ? 3 : 1.5,
    arrows: "to",
  }));
  state.nodes = new vis.DataSet(nodes);
  state.edges = new vis.DataSet(edges);
}

function render() {
  const container = $("net");
  const options = {
    physics: { enabled: true, barnesHut: { gravitationalConstant: -4000, centralGravity: 0.1 } },
    interaction: { hover: true, tooltipDelay: 100 },
    layout: { improvedLayout: true },
  };
  state.network = new vis.Network(container, { nodes: state.nodes, edges: state.edges }, options);
  state.network.on("click", (params) => {
    if (params.nodes.length) showDetail(params.nodes[0]);
    else $("detail").innerHTML = '<p class="empty">Click a node to see details.</p>';
  });
}

function showDetail(id) {
  const d = state.data;
  const node = d.nodes.find((n) => n.id === id);
  if (!node) return;
  const outEdges = d.edges.filter((e) => e.source === id);
  const inEdges = d.edges.filter((e) => e.target === id);
  const nameOf = (nid) => (d.nodes.find((n) => n.id === nid) || {}).label || nid;
  let html = `<h3>${node.label}</h3><div class="meta">${node.kind}${node.country ? " · " + node.country : ""}${node.year ? " · " + node.year : ""}</div>`;
  if (outEdges.length) {
    html += "<ul>" + outEdges.map((e) =>
      `<li><b>${e.type}</b> → ${nameOf(e.target)}${e.detail ? " — " + e.detail : ""}</li>`).join("") + "</ul>";
  }
  if (inEdges.length) {
    html += "<ul>" + inEdges.map((e) =>
      `<li>${nameOf(e.source)} → <b>${e.type}</b></li>`).join("") + "</ul>";
  }
  $("detail").innerHTML = html;
}

function buildLegend() {
  const nodeLegend = [
    ["ego", "Gates Foundation (ego)"],
    ["initiative", "Initiative"],
    ["actor", "Co-actor"],
  ].map(([k, l]) => `<span><span class="dot" style="background:${NODE_COLORS[k].background}"></span>${l}</span>`).join("");
  const edgeLegend = Object.entries(EDGE_COLORS)
    .map(([t, c]) => `<span><span class="line" style="background:${c}"></span>${t}</span>`).join("");
  $("legend").innerHTML = nodeLegend + edgeLegend;
}

function buildRelFilter() {
  const types = [...new Set(state.data.edges.map((e) => e.type))].sort();
  const sel = $("relfilter");
  for (const t of types) {
    const o = document.createElement("option");
    o.value = t; o.textContent = t;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => {
    const t = sel.value;
    if (!t) { state.edges.forEach((e) => state.edges.update({ id: e.id, hidden: false })); }
    else { state.edges.forEach((e) => state.edges.update({ id: e.id, hidden: e.type !== t })); }
    $("count").textContent = `${state.edges.get({ filter: (e) => !e.hidden }).length} / ${state.data.edge_count} edges`;
  });
}

function renderSummary() {
  $("summary").innerHTML =
    `<b>${state.data.initiative_count}</b> initiatives · <b>${state.data.node_count}</b> nodes · ` +
    `<b>${state.data.edge_count}</b> edges. Ego: <b>Gates Foundation</b>.`;
}

async function load() {
  try {
    state.data = await (await fetch("data/gates-egonet.json")).json();
  } catch (e) {
    $("net").innerHTML = '<p class="empty">Could not load data/gates-egonet.json — serve over HTTP, not file://.</p>';
    return;
  }
  renderSummary();
  buildLegend();
  buildRelFilter();
  buildGraph();
  render();
}

load();
