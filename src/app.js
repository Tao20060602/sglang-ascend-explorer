import { scenario, SOURCE_COMMIT } from "./content.js";
import { EXPLANATIONS } from "./explanations.js";
import {
  MODELS,
  KV_CHANGES,
  modelContext,
  modelScenario,
  modelSources,
} from "./models.js";

const $ = (id) => document.getElementById(id);
const ns = "http://www.w3.org/2000/svg";
const statusText = {
  S: "S 保持 / 复用",
  C: "C 核对 / 条件变化",
  A: "A 直接适配 / 调优",
};
let context, nodes, parent;
function readLocation() {
  const params = new URLSearchParams(location.hash.slice(1));
  const scenarioName = params.get("scenario"),
    variant = params.get("variant"),
    focus = params.get("scope");
  const requestedModel = params.get("model");
  const model = Object.hasOwn(MODELS, requestedModel)
    ? requestedModel
    : "deepseek";
  const activeContext = modelContext(model);
  const kvChange = Object.hasOwn(KV_CHANGES, params.get("kv"))
    ? params.get("kv")
    : "layout";
  return {
    model,
    kvChange,
    scenario: ["overview", "attention", "kv", "graph", "quant"].includes(
      scenarioName,
    )
      ? scenarioName
      : "overview",
    variant: ["same", "output", "layout"].includes(variant) ? variant : "same",
    graph: params.get("graph") === "1",
    focus:
      activeContext.active.has(focus) &&
      activeContext.nodes[focus].children.length
        ? focus
        : "root",
  };
}
const state = {
  ...readLocation(),
  selected: "attention",
  edge: null,
  step: 0,
  zoom: 1,
};
if (state.focus !== "root") state.selected = state.focus;
const elk = new ELK();
let current,
  visible,
  edges,
  layout,
  renderVersion = 0;

function element(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function svg(tag, attrs = {}) {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function button(text, action, cls = "") {
  const b = element("button", cls, text);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}
function save() {
  const p = new URLSearchParams({
    model: state.model,
    scope: state.focus,
    scenario: state.scenario,
  });
  if (state.scenario === "kv") p.set("kv", state.kvChange);
  if (state.scenario === "attention") {
    p.set("variant", state.variant);
    if (state.graph) p.set("graph", "1");
  }
  history.replaceState(null, "", "#" + p);
}
function status(id) {
  return current.map ? current.map[id] || "S" : nodes[id].status;
}
function inStage(id) {
  return (current.steps[state.step]?.active || []).some((x) => {
    while (x) {
      if (x === id) return true;
      x = parent[x];
    }
    return false;
  });
}
function go(id) {
  state.selected = id === "root" ? "attention" : id;
  if (id === "root" || nodes[id].children.length) state.focus = id;
  state.edge = null;
  render();
  save();
}
function sourceUrl(n) {
  return `https://github.com/sgl-project/sglang/blob/${SOURCE_COMMIT}/python/sglang/srt/${n.file}${n.line ? "#L" + n.line : ""}`;
}

function renderTree() {
  const tree = $("tree");
  tree.replaceChildren();
  const add = (id, host) => {
    const n = nodes[id];
    const b = button(
      "",
      () => go(id),
      "tree-button" +
        (state.focus === id || state.selected === id ? " active" : ""),
    );
    b.append(
      element("span", "tree-marker", n.children.length ? "›" : "·"),
      element("span", "", n.title),
    );
    b.setAttribute(
      "aria-label",
      n.title + (n.children.length ? "，展开子模块" : "，查看说明"),
    );
    host.append(b);
    let p = state.focus;
    let expanded = p === id;
    while (p) {
      if (parent[p] === id) expanded = true;
      p = parent[p];
    }
    if (expanded && n.children.length) {
      const group = element("div", "tree-nested");
      n.children.forEach((c) => add(c, group));
      host.append(group);
    }
  };
  tree.append(
    button(
      "引擎全景",
      () => go("root"),
      "tree-button" + (state.focus === "root" ? " active" : ""),
    ),
  );
  context.roots.forEach((id) => add(id, tree));
}

function renderControls() {
  $("model-select").value = state.model;
  $("kv-change").value = state.kvChange;
  $("kv-options").hidden = state.scenario !== "kv";
  const summary = $("model-summary");
  summary.replaceChildren(
    element("strong", "", context.profile.checkpoint),
    element("p", "", context.profile.mechanisms),
    element("p", "model-coverage", context.profile.coverage),
  );
  const sources = element("div", "model-sources");
  for (const link of modelSources(context.profile)) {
    const a = element("a", "", link.title + " ↗");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    sources.append(a);
  }
  summary.append(sources);
  const effects = $("impact-chain");
  effects.replaceChildren();
  $("impact-panel").hidden = !current.effects?.length;
  for (const [index, effect] of (current.effects || []).entries()) {
    const item = element("li");
    item.append(
      button(`${index + 1} · ${effect.title} ↗`, () => go(effect.node)),
      element("p", "", effect.text),
    );
    effects.append(item);
  }
  $("scenario").value = state.scenario;
  $("variant").value = state.variant;
  $("with-graph").checked = state.graph;
  $("attention-options").hidden = state.scenario !== "attention";
  $("case").hidden = !current.steps.length;
  $("case-title").textContent = current.title;
  $("steps").replaceChildren();
  current.steps.forEach((s, i) => {
    const b = button(`${i + 1} ${s.title}`, () => {
      state.step = i;
      render();
    });
    b.setAttribute("aria-pressed", String(i === state.step));
    $("steps").append(b);
  });
  $("step-detail").textContent = current.steps[state.step]?.detail || "";
  $("step-count").textContent = `${state.step + 1} / ${current.steps.length}`;
  $("prev").disabled = state.step === 0;
  $("next").disabled = state.step >= current.steps.length - 1;
  const crumbs = $("breadcrumbs");
  crumbs.replaceChildren();
  crumbs.append(button("引擎全景", () => go("root")));
  if (state.focus !== "root") {
    const chain = [];
    let p = state.focus;
    while (p) {
      chain.unshift(p);
      p = parent[p];
    }
    for (const id of chain) {
      crumbs.append(
        element("span", "", "/"),
        button(nodes[id].title, () => go(id)),
      );
    }
  }
  $("scope-title").textContent =
    state.focus === "root"
      ? "引擎全景"
      : nodes[state.focus].title + " · 内部关系";
}

function detailBlock(title, values) {
  if (!values?.length) return;
  const d = element("section", "detail-block");
  d.append(element("h3", "", title));
  if (values.length === 1) d.append(element("p", "", values[0]));
  else {
    const list = element("ul");
    values.forEach((v) => list.append(element("li", "", v)));
    d.append(list);
  }
  $("inspector").append(d);
}

function inspect() {
  const host = $("inspector");
  host.replaceChildren();
  const edge = edges.find((e) => e.id === state.edge);
  if (edge) {
    host.append(
      element("div", "detail-kicker", `RELATION ${edge.number} / 交互契约`),
      element("h2", "inspector-title", edge.label),
    );
    host.append(
      element(
        "code",
        "inspector-code",
        `${nodes[edge.from].title} ${edge.both ? "↔" : "→"} ${nodes[edge.to].title}`,
      ),
    );
    detailBlock("交互类型", [
      edge.kind === "config"
        ? "配置 / 约束关系（虚线）"
        : edge.both
          ? "双向数据或结果交换（两个箭头尖端）"
          : "单向调用或数据流（箭头指向目标）",
    ]);
    detailBlock("传递什么", [edge.payload]);
    detailBlock("变化如何向外传导", [edge.impact]);
    detailBlock("阅读边界", [
      "本图表达模块之间的逻辑契约，不代表所有模型、所有执行模式都会沿同一调用顺序运行。",
    ]);
    const links = element("section", "detail-block");
    links.append(element("h3", "", "两端源码入口"));
    for (const id of [edge.from, edge.to]) {
      const n = nodes[id],
        a = element("a", "source-link", n.file + (n.line ? ":" + n.line : ""));
      a.href = sourceUrl(n);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      links.append(a);
    }
    host.append(links);
    return;
  }
  const n = nodes[state.selected] || nodes.attention,
    extra = n.details || EXPLANATIONS[n.id] || {};
  host.append(
    element("div", "detail-kicker", "MODULE / 模块说明"),
    element("h2", "inspector-title", n.title),
  );
  host.append(
    element("span", "status " + status(n.id), statusText[status(n.id)]),
    element("code", "inspector-code", n.code),
  );
  detailBlock("职责", [n.role]);
  detailBlock("输入", extra.inputs);
  detailBlock("输出", extra.outputs);
  detailBlock("相对不变量", extra.stable || [n.contract]);
  detailBlock("本场景的适配 / 优化", [
    current.notes[n.id] ||
      (current.map && status(n.id) === "S"
        ? "当前场景通常复用；仍需保持接口语义。"
        : n.change),
  ]);
  detailBlock("接口契约", [n.contract]);
  detailBlock("验证重点", extra.checks);
  detailBlock("可能的连锁影响", extra.effects);
  const incoming = edges.filter(
    (e) => e.to === n.id || (e.both && e.from === n.id),
  );
  const outgoing = edges.filter(
    (e) => e.from === n.id || (e.both && e.to === n.id),
  );
  detailBlock(
    "本层上游 / 输入关系",
    incoming.map((e) => `${e.number} · ${e.label}：${e.payload}`),
  );
  detailBlock(
    "本层下游 / 输出关系",
    outgoing.map((e) => `${e.number} · ${e.label}：${e.impact}`),
  );
  const links = element("section", "detail-block");
  links.append(element("h3", "", "固定版本源码依据"));
  const a = element("a", "source-link", n.file + (n.line ? ":" + n.line : ""));
  a.href = sourceUrl(n);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  links.append(a);
  host.append(links);
  if (n.children.length)
    host.append(
      button("展开 " + n.children.length + " 个子模块", () => go(n.id)),
    );
}

function renderRelations() {
  $("relation-count").textContent = `${edges.length} 条独立连接`;
  const host = $("relationships");
  host.replaceChildren();
  if (!edges.length) {
    host.append(
      element(
        "p",
        "empty-relations",
        "本层模块之间没有声明直接调用。请查看各模块说明与上层交互，避免将并列功能读成串行流程。",
      ),
    );
    return;
  }
  edges.forEach((e) => {
    const b = button(
      "",
      () => selectEdge(e.id),
      "relation-button" + (e.id === state.edge ? " selected" : ""),
    );
    b.setAttribute(
      "aria-label",
      `关系 ${e.number}：${nodes[e.from].title}${e.both ? "与" : "到"}${nodes[e.to].title}，${e.label}`,
    );
    b.append(element("span", "relation-number", e.number));
    const text = element("span");
    text.append(
      element(
        "span",
        "relation-title",
        `${nodes[e.from].title} ${e.both ? "↔" : "→"} ${nodes[e.to].title} · ${e.label}`,
      ),
      element("span", "relation-payload", e.payload),
    );
    b.append(text);
    host.append(b);
  });
}

function selectEdge(id) {
  state.edge = id;
  inspect();
  renderRelations();
  emphasize(id);
}
function emphasize(id) {
  document.querySelectorAll("[data-edge-id]").forEach((group) => {
    group.classList.toggle("edge-dim", !!id && group.dataset.edgeId !== id);
    group
      .querySelector(".edge-path")
      ?.classList.toggle("emphasized", group.dataset.edgeId === id);
    group
      .querySelector(".edge-label")
      ?.classList.toggle("selected", group.dataset.edgeId === id);
  });
}

function emphasizeModule(id) {
  document.querySelectorAll("[data-edge-id]").forEach((group) => {
    const connected = group.dataset.from === id || group.dataset.to === id;
    group.classList.toggle("edge-dim", !connected);
    group
      .querySelector(".edge-path")
      ?.classList.toggle("emphasized", connected);
  });
}

function makeLayout() {
  const ports = {};
  visible.forEach((id) => (ports[id] = []));
  const layoutEdges = edges.map((e, index) => {
    const sid = e.from + "__out_" + index,
      tid = e.to + "__in_" + index;
    ports[e.from].push({
      id: sid,
      width: 6,
      height: 6,
      layoutOptions: {
        "elk.port.side": "SOUTH",
        "elk.port.index": String(index),
      },
    });
    ports[e.to].push({
      id: tid,
      width: 6,
      height: 6,
      layoutOptions: {
        "elk.port.side": "NORTH",
        "elk.port.index": String(index),
      },
    });
    const label = e.number + " " + e.label;
    const width = Math.max(
      54,
      Array.from(label).reduce(
        (w, c) => w + (/[\u3400-\u9fff]/.test(c) ? 11 : 6.5),
        0,
      ) + 16,
    );
    return {
      id: e.id,
      sources: [sid],
      targets: [tid],
      labels: [
        {
          id: e.id + "__label",
          text: label,
          width,
          height: 24,
          layoutOptions: { "elk.edgeLabels.placement": "CENTER" },
        },
      ],
    };
  });
  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.padding": "[top=40,left=40,bottom=40,right=40]",
      "elk.spacing.nodeNode": "44",
      "elk.spacing.edgeEdge": "22",
      "elk.spacing.edgeNode": "24",
      "elk.layered.spacing.nodeNodeBetweenLayers": "105",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "22",
      "elk.layered.spacing.edgeNodeBetweenLayers": "28",
      "elk.layered.mergeEdges": "false",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    },
    children: visible.map((id) => ({
      id,
      width: 246,
      height: 124,
      ports: ports[id],
      layoutOptions: { "elk.portConstraints": "FIXED_ORDER" },
    })),
    edges: layoutEdges,
  };
}

function draw(result) {
  const graph = $("graph");
  graph.replaceChildren();
  graph.setAttribute("role", "group");
  graph.setAttribute("viewBox", `0 0 ${result.width} ${result.height}`);
  const defs = svg("defs");
  const marker = svg("marker", {
    id: "arrow",
    viewBox: "0 0 12 12",
    refX: 10,
    refY: 6,
    markerWidth: 9,
    markerHeight: 9,
    orient: "auto-start-reverse",
    markerUnits: "userSpaceOnUse",
  });
  marker.append(svg("path", { d: "M1,1 L11,6 L1,11 Z", fill: "var(--line)" }));
  defs.append(marker);
  graph.append(defs);
  const labelLayer = svg("g");
  for (const edge of result.edges || []) {
    const data = edges.find((e) => e.id === edge.id),
      group = svg("g", {
        "data-edge-id": edge.id,
        "data-from": data.from,
        "data-to": data.to,
      });
    for (const section of edge.sections || []) {
      const points = [
        section.startPoint,
        ...(section.bendPoints || []),
        section.endPoint,
      ];
      const d = points
        .map((p, i) => (i ? "L" : "M") + p.x + "," + p.y)
        .join(" ");
      const halo = svg("path", { d, class: "edge-halo" }),
        path = svg("path", {
          d,
          class: "edge-path " + data.kind,
          "marker-end": "url(#arrow)",
        });
      if (data.both) path.setAttribute("marker-start", "url(#arrow)");
      const hit = svg("path", { d, class: "edge-hit" });
      hit.addEventListener("click", () => selectEdge(edge.id));
      group.append(halo, path, hit);
    }
    for (const label of edge.labels || []) {
      const g = svg("g", {
        class: "edge-label",
        transform: `translate(${label.x},${label.y})`,
      });
      g.append(
        svg("rect", { width: label.width, height: label.height }),
        svg("text", { x: 8, y: 16 }),
      );
      g.lastChild.textContent = label.text;
      g.addEventListener("click", () => selectEdge(edge.id));
      group.append(g);
    }
    graph.append(group);
  }
  for (const child of result.children) {
    const n = nodes[child.id],
      group = svg("g", {
        "data-module-id": n.id,
        transform: `translate(${child.x},${child.y})`,
      });
    const box = svg("foreignObject", {
      width: child.width,
      height: child.height,
      x: 0,
      y: 0,
    });
    const b = button(
      "",
      () => go(n.id),
      "module-node " + status(n.id) + (inStage(n.id) ? " stage-active" : ""),
    );
    b.setAttribute(
      "aria-label",
      n.title +
        "，" +
        statusText[status(n.id)] +
        (n.children.length ? "，展开子模块" : "，查看接口说明"),
    );
    b.addEventListener("mouseenter", () => emphasizeModule(n.id));
    b.addEventListener("mouseleave", () => emphasize(state.edge));
    b.addEventListener("focus", () => emphasizeModule(n.id));
    b.addEventListener("blur", () => emphasize(state.edge));
    b.append(
      element("span", "module-title", n.title),
      element("span", "module-code", n.code),
    );
    const meta = element("span", "module-meta");
    meta.append(
      element("span", "status " + status(n.id), statusText[status(n.id)]),
      element(
        "span",
        "module-open",
        n.children.length ? n.children.length + " 个子模块 ›" : "契约 / 源码",
      ),
    );
    b.append(meta);
    box.append(b);
    group.append(box);
    for (const port of child.ports || [])
      group.append(
        svg("rect", {
          x: port.x,
          y: port.y,
          width: port.width,
          height: port.height,
          class: "port",
          rx: 1,
        }),
      );
    graph.append(group);
  }
  graph.append(labelLayer);
  updateZoom();
  emphasize(state.edge);
}

function updateZoom() {
  if (!layout) return;
  $("graph").setAttribute("width", layout.width * state.zoom);
  $("graph").setAttribute("height", layout.height * state.zoom);
  $("zoom-label").textContent = Math.round(state.zoom * 100) + "%";
}
async function render() {
  const version = ++renderVersion;
  context = modelContext(state.model);
  ({ nodes, parent } = context);
  current = modelScenario(state, scenario(state), context);
  state.step = Math.min(state.step, Math.max(0, current.steps.length - 1));
  visible =
    state.focus === "root" ? context.roots : nodes[state.focus].children;
  edges = context.relations(state.focus);
  renderTree();
  renderControls();
  renderRelations();
  inspect();
  $("diagram").setAttribute("aria-busy", "true");
  $("loading").hidden = false;
  try {
    const result = await elk.layout(makeLayout());
    if (version !== renderVersion) return;
    layout = result;
    draw(result);
    $("diagram").setAttribute("aria-busy", "false");
    $("loading").hidden = true;
  } catch (error) {
    $("loading").textContent = "布局未完成：" + error.message;
    $("diagram").setAttribute("aria-busy", "false");
    console.error(error);
  }
}

for (const [id, profile] of Object.entries(MODELS)) {
  const option = element("option", "", profile.name);
  option.value = id;
  $("model-select").append(option);
}
for (const [id, label] of Object.entries(KV_CHANGES)) {
  const option = element("option", "", label);
  option.value = id;
  $("kv-change").append(option);
}
$("model-select").addEventListener("change", (e) => {
  state.model = e.target.value;
  state.focus = "root";
  state.selected = state.scenario === "kv" ? "memory" : "model";
  state.edge = null;
  state.step = 0;
  render();
  save();
});
$("kv-change").addEventListener("change", (e) => {
  state.kvChange = e.target.value;
  state.edge = null;
  state.step = 0;
  render();
  save();
});
$("scenario").addEventListener("change", (e) => {
  state.scenario = e.target.value;
  state.focus = "root";
  state.selected =
    state.scenario === "kv"
      ? "memory"
      : state.scenario === "graph"
        ? "graph"
        : state.scenario === "quant"
          ? "ops"
          : "attention";
  state.edge = null;
  state.step = 0;
  render();
  save();
});
$("variant").addEventListener("change", (e) => {
  state.variant = e.target.value;
  state.edge = null;
  state.step = 0;
  render();
  save();
});
$("with-graph").addEventListener("change", (e) => {
  state.graph = e.target.checked;
  state.edge = null;
  render();
  save();
});
$("prev").addEventListener("click", () => {
  state.step = Math.max(0, state.step - 1);
  render();
});
$("next").addEventListener("click", () => {
  state.step = Math.min(current.steps.length - 1, state.step + 1);
  render();
});
$("zoom-in").addEventListener("click", () => {
  state.zoom = Math.min(1.8, state.zoom + 0.1);
  updateZoom();
});
$("zoom-out").addEventListener("click", () => {
  state.zoom = Math.max(0.3, state.zoom - 0.1);
  updateZoom();
});
$("fit").addEventListener("click", () => {
  if (!layout) return;
  state.zoom = Math.min(1, ($("diagram").clientWidth - 12) / layout.width);
  updateZoom();
});
window.addEventListener("hashchange", () => {
  Object.assign(state, readLocation(), { edge: null, step: 0 });
  state.selected = state.focus === "root" ? "attention" : state.focus;
  render();
});
render();
