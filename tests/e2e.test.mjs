import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

let browser, server, base, page;
const errors = [];
before(async () => {
  await mkdir(new URL("../test-results/", import.meta.url), {
    recursive: true,
  });
  server = spawn(process.execPath, ["scripts/serve.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  base = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.stdout.on("data", (d) => {
      const url = d.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (url) resolve(url[0]);
    });
    server.once("exit", (code) => reject(new Error("Server exited " + code)));
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  page = await browser.newPage({
    viewport: { width: 1550, height: 1100 },
    colorScheme: "light",
  });
  page.on("pageerror", (e) => errors.push(e.message));
});
after(async () => {
  await browser?.close();
  server?.kill();
});
const ready = async () => {
  await page.locator('#diagram[aria-busy="false"]').waitFor();
  await page.locator("[data-module-id] button").first().waitFor();
};
const open = async (scope = "root") => {
  await page.goto(base + "/#model=generic&scope=" + scope);
  await ready();
};
const module = (title) =>
  page.locator("#graph").getByRole("button", { name: new RegExp("^" + title) });

test("model selection changes real state topology and KV optimization cascades", async () => {
  await page.goto(base + "/#model=deepseek&scenario=kv&kv=layout&scope=memory");
  await ready();
  assert.equal(await page.locator("#model-select").inputValue(), "deepseek");
  await module("模型缓存与状态池").click();
  await ready();
  await module("共享全局 KV").click();
  await ready();
  assert.match(await page.locator("#inspector").innerText(), /source|共享/);
  assert.match(
    await page.locator("#inspector a.source-link").first().getAttribute("href"),
    /deepseek_v4/,
  );
  await page.locator("#model-select").selectOption("kimi");
  await ready();
  assert.equal(await page.locator("#scope-title").innerText(), "引擎全景");
  await module("KV Cache 与内存").click();
  await ready();
  await module("模型缓存与状态池").click();
  await ready();
  assert.equal(await module("KDA 递推与卷积状态").count(), 1);
  assert.equal(await module("Gated MLA 潜变量缓存").count(), 1);
  await page.locator("#kv-change").selectOption("precision");
  await ready();
  assert.match(
    await module("KDA 递推与卷积状态").getAttribute("aria-label"),
    /S 保持/,
  );
  await module("KDA 递推与卷积状态").click();
  await ready();
  assert.match(await page.locator("#inspector").innerText(), /递推|累加/);
  await page.locator("#kv-change").selectOption("reuse");
  await ready();
  assert.match(
    await module("KDA 递推与卷积状态").getAttribute("aria-label"),
    /A 直接/,
  );
  await page
    .locator("#impact-chain")
    .getByRole("button", { name: /计算与状态接口/ })
    .click();
  await ready();
  await page.locator("#kv-change").selectOption("precision");
  await ready();
  assert.match(
    await module("Gated MLA Attention").getAttribute("aria-label"),
    /A 直接/,
  );
  assert.match(
    await module("KDA 递推 Attention").getAttribute("aria-label"),
    /C 核对/,
  );
  await page.locator("#model-select").selectOption("glm");
  await ready();
  await page.locator("#kv-change").selectOption("capacity");
  await ready();
  await module("KV Cache 与内存").click();
  await ready();
  await module("模型缓存与状态池").click();
  await ready();
  assert.equal(await module("MLA 潜变量缓存").count(), 1);
  assert.equal(await module("DSA 索引键缓存").count(), 1);
  await module("显存预算 / 容量").click();
  await ready();
  assert.match(await page.locator("#inspector").innerText(), /预算/);
  const url = page.url();
  await page.reload();
  await ready();
  assert.equal(page.url(), url);
  assert.equal(await page.locator("#model-select").inputValue(), "glm");
  assert.equal(await page.locator("#kv-change").inputValue(), "capacity");
  assert.deepEqual(errors, []);
});

test("reader drills into real modules, selects an interface and follows pinned evidence", async () => {
  await open();
  await module("Attention 后端").click();
  await ready();
  await module("Decode 模式与分支").click();
  await ready();
  await module("Paged Attention 分支").click();
  await ready();
  await module("结果布局与输出空间").click();
  await ready();
  assert.match(await page.locator("#inspector").innerText(), /head|THD/);
  assert.match(
    await page.locator("#inspector a.source-link").first().getAttribute("href"),
    /66cac6b79ccffa13c108297fad8a43ddc49d06f8/,
  );
  await page.locator("#relationships button").first().click();
  assert.match(await page.locator("#inspector").innerText(), /传递什么/);
  assert.equal(await page.locator(".edge-path.emphasized").count(), 1);
  await page
    .getByRole("button", { name: "引擎全景", exact: true })
    .last()
    .click();
  await ready();
  await module("KV Cache 与内存").focus();
  await page.keyboard.press("Enter");
  await ready();
  assert.match(await page.locator("#scope-title").innerText(), /KV Cache/);
});

test("Attention conditions change the affected modules without turning every dependency into a required rewrite", async () => {
  await open();
  await page.locator("#scenario").selectOption("attention");
  await ready();
  assert.match(
    await module("KV Cache 与内存").getAttribute("aria-label"),
    /S 保持/,
  );
  await page.locator("#variant").selectOption("layout");
  await ready();
  assert.match(
    await module("KV Cache 与内存").getAttribute("aria-label"),
    /A 直接/,
  );
  assert.match(
    await module("调度与批处理").getAttribute("aria-label"),
    /C 核对/,
  );
  await page.locator("#with-graph").check();
  await ready();
  assert.match(
    await module("图执行与编译").getAttribute("aria-label"),
    /C 核对/,
  );
  const initial = await page.locator("#step-detail").innerText();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await ready();
  assert.notEqual(await page.locator("#step-detail").innerText(), initial);
  for (const scenario of ["kv", "graph", "quant"]) {
    await page.locator("#scenario").selectOption(scenario);
    await ready();
    while (await page.locator("#next").isEnabled()) {
      await page.locator("#next").click();
      await ready();
    }
    assert.equal(await page.locator("#next").isEnabled(), false);
    assert.equal(
      await page.locator("#steps button").last().getAttribute("aria-pressed"),
      "true",
    );
  }
  assert.deepEqual(errors, []);
});

// Inspect rendered geometry, rather than reproducing ELK's layout algorithm.
async function geometry() {
  return page.evaluate(() => {
    const graph = document.getElementById("graph");
    const boxes = [...graph.querySelectorAll("[data-module-id]")].map((g) => {
      const [x, y] = g
        .getAttribute("transform")
        .match(/[-\d.]+/g)
        .map(Number);
      const r = g.querySelector("foreignObject");
      return {
        id: g.dataset.moduleId,
        x,
        y,
        w: +r.getAttribute("width"),
        h: +r.getAttribute("height"),
      };
    });
    const paths = [...graph.querySelectorAll(".edge-path")].map((p) => ({
      id: p.parentElement.dataset.edgeId,
      to: p.parentElement.dataset.to,
      points: [
        ...p.getAttribute("d").matchAll(/[ML]([-\d.eE]+),([-\d.eE]+)/g),
      ].map((m) => ({ x: +m[1], y: +m[2] })),
    }));
    const segments = [];
    const through = [];
    const overlaps = [];
    const wrongTargets = [];
    for (const p of paths) {
      const end = p.points.at(-1),
        target = boxes.find((b) => b.id === p.to);
      if (
        !(
          end.x >= target.x - 7 &&
          end.x <= target.x + target.w + 7 &&
          end.y >= target.y - 7 &&
          end.y <= target.y + target.h + 7 &&
          (Math.abs(end.y - target.y) <= 7 ||
            Math.abs(end.y - target.y - target.h) <= 7 ||
            Math.abs(end.x - target.x) <= 7 ||
            Math.abs(end.x - target.x - target.w) <= 7)
        )
      )
        wrongTargets.push(p.id);
      for (let i = 1; i < p.points.length; i++) {
        const a = p.points[i - 1],
          b = p.points[i];
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 0.1) continue;
        const horizontal = Math.abs(a.y - b.y) < 0.1;
        const segment = {
          id: p.id,
          horizontal,
          c: horizontal ? a.y : a.x,
          lo: horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
          hi: horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
        };
        segments.push(segment);
        for (const box of boxes) {
          const hit = horizontal
            ? segment.c > box.y + 1 &&
              segment.c < box.y + box.h - 1 &&
              Math.min(segment.hi, box.x + box.w - 1) >
                Math.max(segment.lo, box.x + 1)
            : segment.c > box.x + 1 &&
              segment.c < box.x + box.w - 1 &&
              Math.min(segment.hi, box.y + box.h - 1) >
                Math.max(segment.lo, box.y + 1);
          if (hit) through.push([p.id, box.id]);
        }
      }
    }
    for (let i = 0; i < segments.length; i++)
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i],
          b = segments[j];
        if (
          a.id !== b.id &&
          a.horizontal === b.horizontal &&
          Math.abs(a.c - b.c) < 0.1 &&
          Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > 1
        )
          overlaps.push([a.id, b.id]);
      }
    const labelCollisions = [];
    for (const rect of graph.querySelectorAll(".edge-label rect")) {
      const r = rect.getBoundingClientRect();
      for (const box of graph.querySelectorAll("foreignObject")) {
        const b = box.getBoundingClientRect();
        if (
          Math.min(r.right, b.right) - Math.max(r.left, b.left) > 1 &&
          Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 1
        )
          labelCollisions.push(rect.parentElement.textContent);
      }
    }
    return {
      nodes: boxes.length,
      relations: paths.length,
      through,
      overlaps,
      wrongTargets,
      labelCollisions,
    };
  });
}

test("each hierarchy routes independent edges around nodes with readable labels and correct targets", async () => {
  const manifest = [];
  const views = [
    ...[
      "root",
      "frontend",
      "scheduler",
      "executor",
      "model",
      "attention",
      "decode",
      "paged",
      "memory",
      "kv-pool",
      "ops",
      "graph",
      "comm",
      "platform",
      "runtime",
    ].map((scope) => ({ model: "generic", scope })),
    ...["deepseek", "glm", "kimi"].flatMap((model) =>
      ["root", "model", "attention", "memory", "kv-pool", "speculation"].map(
        (scope) => ({ model, scope }),
      ),
    ),
  ];
  for (const { model, scope } of views) {
    await page.goto(
      base + "/#model=" + model + "&scope=" + scope + "&scenario=kv&kv=layout",
    );
    await ready();
    const result = await geometry();
    manifest.push({ model, scope, ...result });
    assert.deepEqual(result.through, [], scope + " line crosses a node");
    assert.deepEqual(
      result.overlaps,
      [],
      scope + " distinct connections share a segment",
    );
    assert.deepEqual(
      result.wrongTargets,
      [],
      scope + " arrow points to wrong target",
    );
    assert.deepEqual(
      result.labelCollisions,
      [],
      scope + " label overlaps a node",
    );
  }
  await writeFile(
    new URL("../test-results/layout-manifest.json", import.meta.url),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  assert.deepEqual(errors, []);
});

test("model URLs reject unrelated paths and review paths open the real module", async () => {
  await page.goto(base + "/#model=kimi&scope=paged&scenario=kv&kv=capacity");
  await ready();
  assert.equal(await page.locator("#scope-title").innerText(), "引擎全景");
  assert.match(
    await module("Attention 后端").getAttribute("aria-label"),
    /S 保持/,
  );
  assert.match(
    await module("KV Cache 与内存").getAttribute("aria-label"),
    /A 直接/,
  );
  await page
    .locator("#impact-chain")
    .getByRole("button", { name: /模型状态与所有权/ })
    .click();
  await ready();
  assert.match(await page.locator("#scope-title").innerText(), /KV Cache/);
  await module("模型缓存与状态池").click();
  await ready();
  await module("KDA 递推与卷积状态").click();
  assert.match(
    await page.locator("#inspector").innerText(),
    /并发请求|state 槽/,
  );
  await page.goto(
    base + "/#model=invalid&scope=not-a-module&scenario=kv&kv=invalid",
  );
  await ready();
  assert.equal(await page.locator("#model-select").inputValue(), "deepseek");
  assert.equal(await page.locator("#kv-change").inputValue(), "layout");
  assert.equal(await page.locator("#scope-title").innerText(), "引擎全景");
  assert.deepEqual(errors, []);
});

test("desktop, dark mode and mobile keep usable navigation, zoom and explanatory content", async () => {
  await open();
  await page.locator("#fit").click();
  await page.screenshot({
    path: new URL("../test-results/desktop.png", import.meta.url).pathname,
    fullPage: true,
  });
  const before = await page.locator("#zoom-label").innerText();
  await page.locator("#zoom-in").click();
  assert.notEqual(await page.locator("#zoom-label").innerText(), before);
  await page.emulateMedia({ colorScheme: "dark" });
  await open("paged");
  await page.screenshot({
    path: new URL("../test-results/dark.png", import.meta.url).pathname,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 360, height: 900 });
  await open("attention");
  const size = await page.evaluate(() => ({
    visible: document.documentElement.clientWidth,
    actual: document.documentElement.scrollWidth,
  }));
  assert(size.actual <= size.visible + 1, JSON.stringify(size));
  await module("Decode 模式与分支").click();
  await ready();
  assert.match(await page.locator("#scope-title").innerText(), /Decode/);
  await page.screenshot({
    path: new URL("../test-results/mobile.png", import.meta.url).pathname,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
});

test("model controls, typed state views and impact paths stay readable on desktop and mobile", async () => {
  await page.setViewportSize({ width: 1550, height: 1100 });
  await page.goto(
    base + "/#model=deepseek&scope=kv-pool&scenario=kv&kv=layout",
  );
  await ready();
  await module("共享全局 KV").click();
  await page.locator("#fit").click();
  await page.screenshot({
    path: new URL("../test-results/model-desktop.png", import.meta.url)
      .pathname,
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator("#model-select").selectOption("kimi");
  await ready();
  await module("KV Cache 与内存").click();
  await ready();
  await module("模型缓存与状态池").click();
  await ready();
  await page.locator("#kv-change").selectOption("reuse");
  await ready();
  await page.locator("#fit").click();
  await page.screenshot({
    path: new URL("../test-results/model-dark.png", import.meta.url).pathname,
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.locator("#kv-change").selectOption("precision");
  await ready();
  const size = await page.evaluate(() => ({
    visible: document.documentElement.clientWidth,
    actual: document.documentElement.scrollWidth,
  }));
  assert(size.actual <= size.visible + 1, JSON.stringify(size));
  assert.equal(await page.locator("#model-select").inputValue(), "kimi");
  await page.locator("#fit").click();
  await page.screenshot({
    path: new URL("../test-results/model-mobile.png", import.meta.url).pathname,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
});
