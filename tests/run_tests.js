#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Tests for spark-oes512-demo.html. The score logic lives in ONE place: the <script id="core"> block
// of the page. This runner extracts that block and executes it in a fresh VM context, so the page and
// the tests can never diverge. An independent reference formula (written here from the contract, not
// copied) cross-checks every block score. index.html must be byte-identical to the main file.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const MAIN = path.join(ROOT, "spark-oes512-demo.html");
const INDEX = path.join(ROOT, "index.html");
const html = fs.readFileSync(MAIN, "utf8");

let failures = 0, passes = 0;
function check(name, cond, info) {
  if (cond) { passes++; console.log("PASS " + name + (info ? "  (" + info + ")" : "")); }
  else { failures++; console.log("FAIL " + name + (info ? "  (" + info + ")" : "")); }
}

// ---- 0. index.html is a byte-identical copy ---------------------------------------------------
check("index.html is byte-identical to spark-oes512-demo.html",
  fs.existsSync(INDEX) && Buffer.compare(fs.readFileSync(INDEX), fs.readFileSync(MAIN)) === 0);

// ---- 1. Extract the single core block -------------------------------------------------------
const coreBlocks = [...html.matchAll(/<script id="core">([\s\S]*?)<\/script>/g)];
check("page contains exactly one <script id=\"core\"> block", coreBlocks.length === 1, "found " + coreBlocks.length);
if (coreBlocks.length !== 1) process.exit(1);
const coreSrc = coreBlocks[0][1];
const sandbox = { module: { exports: {} } };
vm.createContext(sandbox);
vm.runInContext(coreSrc, sandbox, { filename: "spark-oes512-demo.html#core" });
const core = sandbox.module.exports;

const uiSrc = [...html.matchAll(/<script(?! id="core")[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
check("UI script does not redefine scoreBlock/scoreFrame/weights",
  !/function\s+(scoreBlock|scoreFrame)\b|\bW_(MAX|RMS|MEAN)\s*=/.test(uiSrc));
check("UI script uses scoreFrame from the core", /scoreFrame\(/.test(uiSrc));

// ---- 2. Contract constants --------------------------------------------------------------------
check("512 = 16 x 32", core.N === 512 && core.N_BLOCKS === 16 && core.BLOCK === 32);
check("weights 0.45 / 0.35 / 0.20", core.W_MAX === 0.45 && core.W_RMS === 0.35 && core.W_MEAN === 0.20);
check("default threshold 0.50", core.DEFAULT_THRESHOLD === 0.5);
check("slider defaults to 0.50", /id="thr"[^>]*value="0\.50"/.test(html));
check("'default 0.50' label and 'Reset to 0.50' button present",
  html.includes("(default 0.50)") && />Reset to 0\.50<\/button>/.test(html) && /\$\('reset'\)\.onclick/.test(uiSrc));

// ---- 3. In-page self-test (the same function the page displays) -------------------------------
for (const [name, ok] of core.selfTests()) check("selfTest: " + name, ok);

// ---- 4. Independent reference formula ---------------------------------------------------------
function refScore(x) {
  const n = x.length, peak = Math.max(...x.map(Math.abs));
  const rms = Math.sqrt(x.reduce((s, v) => s + v * v, 0) / n);
  const mean = x.reduce((s, v) => s + Math.abs(v), 0) / n;
  return 0.45 * peak + 0.35 * rms + 0.20 * mean;
}
const SCEN = ["normal", "local", "drift", "global"];
let maxDiff = 0, frames = 0;
for (const sc of SCEN) for (let seed = 1; seed <= 25; seed++) for (const thr of [0.3, 0.5, 0.8]) {
  const x = core.generate(sc, seed).x, r = core.scoreFrame(x, thr);
  for (let b = 0; b < 16; b++) {
    const ref = refScore(x.slice(b * 32, b * 32 + 32));
    maxDiff = Math.max(maxDiff, Math.abs(ref - r[b].S));
    if ((r[b].status === "alert") !== (r[b].S >= thr)) maxDiff = Infinity;
  }
  frames++;
}
check("core scores match the reference formula on " + frames + " synthetic frames", maxDiff < 1e-12, "max |diff| = " + maxDiff);
const mixed = core.scoreBlock([0.5, -0.5, ...new Array(30).fill(0)], 0.5);
check("hand-computed mixed block", Math.abs(mixed.S - (0.45 * 0.5 + 0.35 * 0.125 + 0.2 * 0.03125)) < 1e-12);
const below = core.scoreBlock(new Array(32).fill(0.4999), 0.5);
check("constant 0.4999 block does not alert (boundary inclusive at 0.50)", below.status === "ok");

// ---- 5. Scenarios behave as described (seeds 1..50, threshold 0.50) ---------------------------
const summary = (sc, seed) => { const s = core.scoreFrame(core.generate(sc, seed).x, 0.5);
  return { alert: s.filter(b => b.status === "alert").map(b => b.block), review: s.filter(b => b.status === "review").map(b => b.block) }; };
const bad = [];
for (let seed = 1; seed <= 50; seed++) {
  const n = summary("normal", seed), l = summary("local", seed), d = summary("drift", seed), g = summary("global", seed), m = summary("missing", seed);
  if (n.alert.length || n.review.length) bad.push("normal@" + seed);
  if (l.alert.length !== 1 || l.review.length) bad.push("local@" + seed);
  if (!d.alert.includes(15) || d.alert.includes(0)) bad.push("drift@" + seed);
  if (g.alert.length < 12) bad.push("global@" + seed);
  if (m.review.length !== 1 || m.alert.length) bad.push("missing@" + seed);
}
check("scenarios: normal quiet, local = 1 alert, drift high-end, global >= 12, missing = 1 review", bad.length === 0, bad.join(" "));
check("generator is deterministic per seed", JSON.stringify(core.generate("local", 9)) === JSON.stringify(core.generate("local", 9)));

// ---- 6. Missing / non-finite data: human review, never scored ---------------------------------
for (const v of [NaN, Infinity, -Infinity, "1", null, undefined]) {
  const f = new Array(512).fill(0); f[200] = v;
  const r = core.scoreFrame(f, 0.5)[6];
  check("value " + String(v) + " in block 6 -> needs human review, not scored", r.S === null && r.status === "review",
    "reason=" + r.reason);
}
let lenRejected = false; try { core.scoreFrame(new Array(511).fill(0), 0.5); } catch (e) { lenRejected = true; }
check("frame of 511 values rejected", lenRejected);

// ---- 7. CSV import ----------------------------------------------------------------------------
const csv = fs.readFileSync(path.join(ROOT, "sample-512.csv"), "utf8");
const sx = core.parseCSV(csv);
check("sample-512.csv parses to 512 finite values", sx.length === 512 && sx.every(Number.isFinite));
const row = new Array(512).fill("0"); row[5] = ""; row[9] = "NaN"; row[11] = "abc";
const rx = core.parseCSV(row.join(","));
check("CSV row: empty/NaN -> missing, text -> rejected", Number.isNaN(rx[5]) && Number.isNaN(rx[9]) && rx[11] === Infinity);
let csvRejected = false; try { core.parseCSV("1,2,3"); } catch (e) { csvRejected = true; }
check("CSV with wrong count rejected", csvRejected);

// ---- 8. Page content and self-containment -----------------------------------------------------
const BANNER = "Independent research prototype by Spark AI NLP. Uses synthetic data only. Not a medical device. Not for diagnosis, treatment, or clinical decision-making.";
check("persistent banner text present", html.includes(BANNER));
check("title present", html.includes("<title>Spark OES-512 BioSignal Explorer</title>"));
const urls = (html.match(/https?:\/\/[^\s"'<>)]+/g) || []).filter(u => u !== "https://sparkainlpx.xyz");
check("no external URL (only the author site as plain text)", urls.length === 0, urls.join(" "));
check("no <link>, @import, src=, fetch() or XMLHttpRequest", !/<link\b|@import|\bsrc\s*=|fetch\(|XMLHttpRequest/.test(html));
check("no Math.random (deterministic)", !/Math\.random/.test(html));

console.log("\n" + passes + " passed, " + failures + " failed");
process.exit(failures ? 1 : 0);
