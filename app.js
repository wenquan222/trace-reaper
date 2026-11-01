const SAMPLE_KEY = Uint8Array.from([
  0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
  0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c,
]);

const DEFAULT_TRACE_COUNT = 180;
const DEFAULT_SAMPLE_COUNT = 420;
const MAX_UPLOAD_TRACES = 320;
const MAX_UPLOAD_SAMPLES = 512;

const state = {
  dataset: null,
  results: null,
  runtimeMs: null,
  running: false,
  log: [],
  worker: null,
};

const ui = {
  engineStatus: document.querySelector("#engine-status"),
  liveDot: document.querySelector(".live-dot"),
  traceCount: document.querySelector("#trace-count"),
  traceCountOutput: document.querySelector("#trace-count-output"),
  noise: document.querySelector("#noise-level"),
  noiseOutput: document.querySelector("#noise-output"),
  leakageModel: document.querySelector("#leakage-model"),
  dropzone: document.querySelector("#dropzone"),
  fileInput: document.querySelector("#trace-file"),
  runButtons: [
    document.querySelector("#run-agent"),
    document.querySelector("#run-agent-hero"),
  ],
  resetButtons: [
    document.querySelector("#reset-sample-hero"),
  ],
  metricTraces: document.querySelector("#metric-traces"),
  metricSamples: document.querySelector("#metric-samples"),
  metricNoise: document.querySelector("#metric-noise"),
  metricState: document.querySelector("#metric-state"),
  metricStateNote: document.querySelector("#metric-state-note"),
  plotState: document.querySelector("#plot-state"),
  canvas: document.querySelector("#trace-canvas"),
  scanLine: document.querySelector("#scan-line"),
  keyGrid: document.querySelector("#key-grid"),
  keyStatus: document.querySelector("#key-status"),
  keyHex: document.querySelector("#key-hex"),
  keyMatch: document.querySelector("#key-match"),
  log: document.querySelector("#agent-log"),
  logCount: document.querySelector("#log-count"),
  confidence: document.querySelector("#confidence"),
  bestByte: document.querySelector("#best-byte"),
  topMargin: document.querySelector("#top-margin"),
  runtime: document.querySelector("#runtime"),
  downloadReport: document.querySelector("#download-report"),
  reportNote: document.querySelector("#report-note"),
};

let sbox = null;
let hamming = null;
let gaussianCache = null;
let resizeTimer = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function multiplyGF(a, b) {
  let result = 0;
  let left = a;
  let right = b;
  for (let i = 0; i < 8; i += 1) {
    if (right & 1) {
      result ^= left;
    }
    const highBit = left & 0x80;
    left = (left << 1) & 0xff;
    if (highBit) {
      left ^= 0x1b;
    }
    right >>= 1;
  }
  return result;
}

function powerGF(value, exponent) {
  let result = 1;
  let base = value;
  let power = exponent;
  while (power > 0) {
    if (power & 1) {
      result = multiplyGF(result, base);
    }
    base = multiplyGF(base, base);
    power >>= 1;
  }
  return result;
}

function rotateLeft8(value, shift) {
  return ((value << shift) | (value >> (8 - shift))) & 0xff;
}

function buildTables() {
  sbox = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    const inverse = value === 0 ? 0 : powerGF(value, 254);
    sbox[value] =
      inverse ^
      rotateLeft8(inverse, 1) ^
      rotateLeft8(inverse, 2) ^
      rotateLeft8(inverse, 3) ^
      rotateLeft8(inverse, 4) ^
      0x63;
  }

  hamming = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    let bits = value;
    let count = 0;
    while (bits) {
      count += bits & 1;
      bits >>>= 1;
    }
    hamming[value] = count;
  }
}

function gaussian() {
  if (gaussianCache !== null) {
    const value = gaussianCache;
    gaussianCache = null;
    return value;
  }
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = Math.random();
  }
  while (v === 0) {
    v = Math.random();
  }
  const magnitude = Math.sqrt(-2 * Math.log(u));
  const angle = 2 * Math.PI * v;
  gaussianCache = magnitude * Math.sin(angle);
  return magnitude * Math.cos(angle);
}

function randomByte() {
  return Math.floor(Math.random() * 256);
}

function generateSynthetic(traceCount, sampleCount, noise) {
  const plaintexts = new Uint8Array(traceCount * 16);
  const traces = new Float32Array(traceCount * sampleCount);
  const positions = [];
  const spacing = Math.floor((sampleCount - 56) / 16);

  for (let byteIndex = 0; byteIndex < 16; byteIndex += 1) {
    positions.push(30 + byteIndex * spacing);
  }

  for (let traceIndex = 0; traceIndex < traceCount; traceIndex += 1) {
    const plaintextOffset = traceIndex * 16;
    const traceOffset = traceIndex * sampleCount;
    for (let byteIndex = 0; byteIndex < 16; byteIndex += 1) {
      plaintexts[plaintextOffset + byteIndex] = randomByte();
    }

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const drift =
        0.12 * Math.sin(sampleIndex * 0.071 + traceIndex * 0.13) +
        0.05 * Math.sin(sampleIndex * 0.219 + traceIndex * 0.41);
      traces[traceOffset + sampleIndex] = gaussian() * noise + drift;
    }

    for (let byteIndex = 0; byteIndex < 16; byteIndex += 1) {
      const plaintextByte = plaintexts[plaintextOffset + byteIndex];
      const sboxValue = sbox[plaintextByte ^ SAMPLE_KEY[byteIndex]];
      const signal = (hamming[sboxValue] - 4) * 2.8;
      const position = positions[byteIndex];
      traces[traceOffset + position] += signal;
      if (position > 0) {
        traces[traceOffset + position - 1] += signal * 0.18;
      }
      if (position + 1 < sampleCount) {
        traces[traceOffset + position + 1] += signal * 0.32;
      }
    }
  }

  return {
    plaintexts,
    traces,
    traceCount,
    sampleCount,
    key: SAMPLE_KEY,
    source: "synthetic",
    noise,
    positions,
    fileName: null,
  };
}

function setStatus(label, tone = "idle", note = "") {
  ui.engineStatus.textContent = label;
  ui.metricState.textContent = tone === "running" ? "SCANNING" : label.replace("AGENT ", "");
  ui.metricStateNote.textContent = note || (tone === "running" ? "worker active" : "local engine");
  ui.liveDot.classList.toggle("is-live", tone === "running");
  ui.plotState.textContent =
    tone === "running" ? "LIVE SCAN" : tone === "done" ? "CAPTURED" : "STANDBY";
  ui.scanLine.classList.toggle("is-running", tone === "running");
}

function addLog(message, tone = "") {
  state.log.push({
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
    message,
    tone,
  });
  renderLog();
}

function renderLog() {
  ui.log.innerHTML = "";
  const visible = state.log.slice(-24);
  for (const entry of visible) {
    const item = document.createElement("li");
    item.className = `log-entry ${entry.tone ? `is-${entry.tone}` : ""}`;

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = entry.time;

    const message = document.createElement("span");
    message.className = "log-message";
    const strong = document.createElement("strong");
    const [tag, ...rest] = entry.message.split(":");
    strong.textContent = tag.toUpperCase();
    message.append(strong, document.createTextNode(rest.length ? `:${rest.join(":")}` : ""));

    item.append(time, message);
    ui.log.append(item);
  }
  ui.logCount.textContent = `${state.log.length} EVENT${state.log.length === 1 ? "" : "S"}`;
  ui.log.scrollTop = ui.log.scrollHeight;
}

function formatHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function makeKeyGrid() {
  ui.keyGrid.innerHTML = "";
  for (let index = 0; index < 16; index += 1) {
    const cell = document.createElement("div");
    cell.className = "key-cell";
    cell.dataset.index = String(index);
    cell.style.setProperty("--confidence", "0");

    const indexLabel = document.createElement("span");
    indexLabel.className = "key-index";
    indexLabel.textContent = `BYTE ${String(index + 1).padStart(2, "0")}`;

    const value = document.createElement("strong");
    value.className = "key-value";
    value.textContent = "--";

    const score = document.createElement("span");
    score.className = "key-score";
    score.textContent = "r --";

    cell.append(indexLabel, value, score);
    ui.keyGrid.append(cell);
  }
}

function updateKeyCell(result) {
  const cell = ui.keyGrid.querySelector(`[data-index="${result.byte}"]`);
  if (!cell) {
    return;
  }
  cell.classList.remove("is-pending");
  cell.classList.toggle("is-weak", result.confidence < 0.22 || result.margin < 0.02);
  cell.style.setProperty("--confidence", String(clamp(result.confidence, 0, 1)));
  cell.querySelector(".key-value").textContent = `0x${result.key
    .toString(16)
    .padStart(2, "0")}`;
  cell.querySelector(".key-score").textContent = `r ${result.top[0].absCorrelation.toFixed(3)}`;
}

function markGridPending() {
  for (const cell of ui.keyGrid.children) {
    cell.classList.add("is-pending");
    cell.classList.remove("is-weak");
    cell.style.setProperty("--confidence", "0");
    cell.querySelector(".key-value").textContent = "--";
    cell.querySelector(".key-score").textContent = "r --";
  }
}

function updateMetrics() {
  if (!state.dataset) {
    return;
  }
  ui.metricTraces.textContent = String(state.dataset.traceCount);
  ui.metricSamples.textContent = String(state.dataset.sampleCount);
  ui.metricNoise.textContent =
    state.dataset.noise === null ? "--" : state.dataset.noise.toFixed(2);
  ui.metricState.textContent = state.running ? "SCANNING" : "READY";
  ui.metricStateNote.textContent = state.running
    ? "worker active"
    : state.dataset.source === "csv"
      ? "csv loaded"
      : "sample loaded";
}

function getMeanAndEnvelope(dataset, count = 28) {
  const sampleCount = dataset.sampleCount;
  const traceCount = Math.min(count, dataset.traceCount);
  const mean = new Float64Array(sampleCount);
  const min = new Float32Array(sampleCount);
  const max = new Float32Array(sampleCount);
  min.fill(Number.POSITIVE_INFINITY);
  max.fill(Number.NEGATIVE_INFINITY);

  for (let traceIndex = 0; traceIndex < traceCount; traceIndex += 1) {
    const offset = traceIndex * sampleCount;
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const value = dataset.traces[offset + sampleIndex];
      mean[sampleIndex] += value;
      if (value < min[sampleIndex]) {
        min[sampleIndex] = value;
      }
      if (value > max[sampleIndex]) {
        max[sampleIndex] = value;
      }
    }
  }

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    mean[sampleIndex] /= traceCount;
  }
  return { mean, min, max, traceCount };
}

function drawPlot(highlightSamples = []) {
  if (!state.dataset) {
    return;
  }
  const canvas = ui.canvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, rect.width);
  const height = Math.max(220, rect.height);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const left = 40;
  const right = 12;
  const top = 14;
  const bottom = 26;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const { mean, min, max, traceCount } = getMeanAndEnvelope(state.dataset);

  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < state.dataset.sampleCount; index += 1) {
    low = Math.min(low, min[index], mean[index]);
    high = Math.max(high, max[index], mean[index]);
  }
  const padding = Math.max(0.1, (high - low) * 0.1);
  low -= padding;
  high += padding;
  const span = Math.max(0.001, high - low);
  const xFor = (index) =>
    left + (index / Math.max(1, state.dataset.sampleCount - 1)) * plotWidth;
  const yFor = (value) => top + ((high - value) / span) * plotHeight;

  ctx.font = '9px "DM Mono", monospace';
  ctx.fillStyle = "rgba(142, 155, 141, 0.72)";
  ctx.strokeStyle = "rgba(216, 255, 62, 0.08)";
  ctx.lineWidth = 1;

  for (let row = 0; row <= 4; row += 1) {
    const y = top + (row / 4) * plotHeight;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    const label = (high - (row / 4) * span).toFixed(1);
    ctx.fillText(label, 4, y + 3);
  }

  for (let column = 0; column <= 6; column += 1) {
    const x = left + (column / 6) * plotWidth;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, height - bottom);
    ctx.stroke();
    const label = String(
      Math.round((column / 6) * (state.dataset.sampleCount - 1)),
    );
    ctx.fillText(label, x - (label.length * 2.5), height - 8);
  }

  ctx.beginPath();
  for (let index = 0; index < state.dataset.sampleCount; index += 1) {
    const x = xFor(index);
    const y = yFor(max[index]);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  for (let index = state.dataset.sampleCount - 1; index >= 0; index -= 1) {
    ctx.lineTo(xFor(index), yFor(min[index]));
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(216, 255, 62, 0.09)";
  ctx.fill();

  ctx.beginPath();
  for (let index = 0; index < state.dataset.sampleCount; index += 1) {
    const x = xFor(index);
    const y = yFor(mean[index]);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = "#d8ff3e";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  for (const sampleIndex of highlightSamples) {
    if (sampleIndex < 0 || sampleIndex >= state.dataset.sampleCount) {
      continue;
    }
    const x = xFor(sampleIndex);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, height - bottom);
    ctx.strokeStyle = "rgba(255, 107, 53, 0.74)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const y = yFor(mean[sampleIndex]);
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "#ff6b35";
    ctx.fill();
  }

  ctx.fillStyle = "rgba(242, 240, 231, 0.68)";
  ctx.font = '9px "DM Mono", monospace';
  ctx.fillText(
    `MEAN OF ${String(traceCount).padStart(2, "0")} TRACES`,
    left + 4,
    top + 12,
  );
}

function computeSummary(results) {
  const recovered = Uint8Array.from(results.map((result) => result.key));
  const averagePeak =
    results.reduce((sum, result) => sum + result.top[0].absCorrelation, 0) /
    results.length;
  const averageMargin =
    results.reduce((sum, result) => sum + result.margin, 0) / results.length;
  const confidence = Math.round(
    100 *
      clamp(
        averagePeak * 0.62 + clamp(averageMargin / 0.16, 0, 1) * 0.38,
        0,
        1,
      ),
  );
  const best = results.reduce((winner, result) =>
    result.top[0].absCorrelation > winner.top[0].absCorrelation ? result : winner,
  );
  const strongestMargin = Math.max(...results.map((result) => result.margin));
  return {
    recovered,
    confidence,
    averagePeak,
    averageMargin,
    best,
    strongestMargin,
  };
}

function getHighlightSamples(results) {
  return [...results]
    .sort((a, b) => b.top[0].absCorrelation - a.top[0].absCorrelation)
    .slice(0, 6)
    .map((result) => result.sample);
}

function finishRun(message) {
  state.results = message.results;
  state.runtimeMs = message.runtimeMs;
  state.running = false;

  const summary = computeSummary(message.results);
  const highlightSamples = getHighlightSamples(message.results);
  const recoveredHex = formatHex(summary.recovered);
  let matchText = "NO GROUND TRUTH";
  let matchCount = null;

  if (state.dataset.key) {
    matchCount = summary.recovered.reduce(
      (count, value, index) => count + (value === state.dataset.key[index] ? 1 : 0),
      0,
    );
    matchText =
      matchCount === 16
        ? "MATCH 16/16 · GROUND TRUTH"
        : `MATCH ${matchCount}/16 · REVIEW`;
  }

  ui.keyHex.textContent = recoveredHex;
  ui.keyMatch.textContent = matchText;
  ui.keyStatus.textContent =
    matchCount === null ? "RECOVERED" : matchCount === 16 ? "LOCKED" : "REVIEW";
  ui.confidence.textContent = `${summary.confidence}%`;
  ui.bestByte.textContent = `#${String(summary.best.byte + 1).padStart(2, "0")} · 0x${summary.best.key
    .toString(16)
    .padStart(2, "0")}`;
  ui.topMargin.textContent = summary.strongestMargin.toFixed(3);
  ui.runtime.textContent = `${(message.runtimeMs / 1000).toFixed(2)}s`;
  ui.downloadReport.disabled = false;
  ui.reportNote.textContent = "Markdown field report is ready.";

  drawPlot(highlightSamples);
  setStatus("AGENT COMPLETE", "done", "analysis captured");
  addLog(
    `verify: ${matchCount === null ? "recovered 16/16 candidates" : `${matchCount}/16 bytes match ground truth`}`,
    matchCount !== null && matchCount < 16 ? "warn" : "",
  );
  addLog(
    `report: confidence ${summary.confidence}% · peak r ${summary.averagePeak.toFixed(3)} · margin ${summary.averageMargin.toFixed(3)}`,
  );
  for (const button of ui.runButtons) {
    button.disabled = false;
  }
}

function runAgent() {
  if (state.running) {
    return;
  }
  if (!state.dataset) {
    loadSample();
  }

  state.running = true;
  state.results = null;
  state.runtimeMs = null;
  state.log = [];
  markGridPending();
  renderLog();
  ui.keyStatus.textContent = "SCANNING";
  ui.keyHex.textContent = "--";
  ui.keyMatch.textContent = "GROUND TRUTH LOCKED";
  ui.confidence.textContent = "--";
  ui.bestByte.textContent = "--";
  ui.topMargin.textContent = "--";
  ui.runtime.textContent = "--";
  ui.downloadReport.disabled = true;
  ui.reportNote.textContent = "Run the agent to unlock the report.";
  setStatus("AGENT RUNNING", "running", "worker active");
  updateMetrics();

  for (const button of ui.runButtons) {
    button.disabled = true;
  }

  const dataset = state.dataset;
  addLog(
    `survey: ${dataset.traceCount} traces × ${dataset.sampleCount} samples · σ ${dataset.noise === null ? "unknown" : dataset.noise.toFixed(2)}`,
  );
  addLog(`scan: 256 hypotheses × 16 bytes · ${ui.leakageModel.value} model`);

  const worker = new Worker("worker.js");
  state.worker = worker;
  worker.onmessage = (event) => {
    const message = event.data;
    if (message.type === "progress") {
      updateKeyCell(message.result);
      addLog(
        `byte ${String(message.completed).padStart(2, "0")}: 0x${message.result.key
          .toString(16)
          .padStart(2, "0")} · r ${message.result.top[0].absCorrelation.toFixed(3)} · margin ${message.result.margin.toFixed(3)}`,
        message.result.confidence < 0.22 ? "warn" : "",
      );
      return;
    }
    if (message.type === "done") {
      finishRun(message);
      worker.terminate();
      state.worker = null;
    }
  };
  worker.onerror = (error) => {
    state.running = false;
    setStatus("AGENT ERROR", "idle", "worker failed");
    addLog(`error: ${error.message || "worker failed"}`, "warn");
    for (const button of ui.runButtons) {
      button.disabled = false;
    }
    worker.terminate();
    state.worker = null;
  };

  const plaintexts = dataset.plaintexts.slice();
  const traces = dataset.traces.slice();
  worker.postMessage(
    {
      type: "analyze",
      plaintexts,
      traces,
      traceCount: dataset.traceCount,
      sampleCount: dataset.sampleCount,
      model: ui.leakageModel.value,
    },
    [plaintexts.buffer, traces.buffer],
  );
}

function loadSample() {
  if (state.running && state.worker) {
    state.worker.terminate();
    state.worker = null;
  }
  state.running = false;
  state.results = null;
  state.runtimeMs = null;
  state.log = [];

  const traceCount = Number(ui.traceCount.value);
  const noise = Number(ui.noise.value);
  const sampleCount = DEFAULT_SAMPLE_COUNT;
  state.dataset = generateSynthetic(traceCount, sampleCount, noise);

  updateMetrics();
  makeKeyGrid();
  renderLog();
  drawPlot();
  setStatus("AGENT IDLE", "idle", "sample loaded");
  ui.keyStatus.textContent = "AWAITING RUN";
  ui.keyHex.textContent = "--";
  ui.keyMatch.textContent = "GROUND TRUTH LOCKED";
  ui.confidence.textContent = "--";
  ui.bestByte.textContent = "--";
  ui.topMargin.textContent = "--";
  ui.runtime.textContent = "--";
  ui.downloadReport.disabled = true;
  ui.reportNote.textContent = "Run the agent to unlock the report.";
  addLog(`ingest: synthetic sample · ${traceCount} traces × ${sampleCount} samples`);
  addLog("survey: trace envelope ready · ground truth locked for verification");
  for (const button of ui.runButtons) {
    button.disabled = false;
  }
}

function parseCsv(text, fileName) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 20) {
    throw new Error("CSV needs at least 20 trace rows.");
  }

  const first = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  const hasHeader = first[0].includes("plaintext") || first[0] === "text";
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows = dataLines.map((line) => line.split(",").map((cell) => cell.trim()));
  const traceCount = Math.min(rows.length, MAX_UPLOAD_TRACES);
  const sampleCount = Math.min(
    Math.max(...rows.slice(0, traceCount).map((row) => row.length - 1)),
    MAX_UPLOAD_SAMPLES,
  );
  if (sampleCount < 16) {
    throw new Error("CSV needs at least 16 sample columns after plaintext_hex.");
  }

  const plaintexts = new Uint8Array(traceCount * 16);
  const traces = new Float32Array(traceCount * sampleCount);
  for (let traceIndex = 0; traceIndex < traceCount; traceIndex += 1) {
    const row = rows[traceIndex];
    const hex = row[0].replace(/^0x/i, "").padStart(32, "0").slice(-32);
    if (!/^[0-9a-f]{32}$/i.test(hex)) {
      throw new Error(`Invalid plaintext_hex at CSV row ${traceIndex + (hasHeader ? 2 : 1)}.`);
    }
    for (let byteIndex = 0; byteIndex < 16; byteIndex += 1) {
      plaintexts[traceIndex * 16 + byteIndex] = Number.parseInt(
        hex.slice(byteIndex * 2, byteIndex * 2 + 2),
        16,
      );
    }
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const value = Number.parseFloat(row[sampleIndex + 1]);
      traces[traceIndex * sampleCount + sampleIndex] = Number.isFinite(value)
        ? value
        : 0;
    }
  }

  return {
    plaintexts,
    traces,
    traceCount,
    sampleCount,
    key: null,
    source: "csv",
    noise: null,
    positions: [],
    fileName,
  };
}

async function handleFile(file) {
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    state.dataset = parseCsv(text, file.name);
    state.results = null;
    state.runtimeMs = null;
    state.log = [];
    updateMetrics();
    makeKeyGrid();
    drawPlot();
    setStatus("AGENT IDLE", "idle", "csv loaded");
    ui.keyStatus.textContent = "AWAITING RUN";
    ui.keyHex.textContent = "--";
    ui.keyMatch.textContent = "NO GROUND TRUTH";
    ui.confidence.textContent = "--";
    ui.bestByte.textContent = "--";
    ui.topMargin.textContent = "--";
    ui.runtime.textContent = "--";
    ui.downloadReport.disabled = true;
    ui.reportNote.textContent = "Run the agent to unlock the report.";
    addLog(
      `ingest: ${file.name} · ${state.dataset.traceCount} traces × ${state.dataset.sampleCount} samples`,
    );
  } catch (error) {
    setStatus("INPUT ERROR", "idle", "csv rejected");
    addLog(`error: ${error.message}`, "warn");
  }
}

function buildReport() {
  if (!state.results) {
    return "";
  }
  const summary = computeSummary(state.results);
  const lines = [
    "# Trace Reaper field report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Dataset: ${state.dataset.source}${state.dataset.fileName ? ` (${state.dataset.fileName})` : ""}`,
    `Traces: ${state.dataset.traceCount}`,
    `Samples per trace: ${state.dataset.sampleCount}`,
    `Leakage model: ${ui.leakageModel.value}`,
    `Runtime: ${(state.runtimeMs / 1000).toFixed(2)} s`,
    `Confidence: ${summary.confidence}%`,
    "",
    "## Recovered key",
    "",
    `\`${formatHex(summary.recovered)}\``,
    "",
    "## Per-byte candidates",
    "",
    "| Byte | Key | Peak r | Margin | Sample | Top 5 candidates |",
    "| ---: | ---: | ---: | ---: | ---: | --- |",
    ...state.results.map(
      (result) =>
        `| ${result.byte + 1} | 0x${result.key.toString(16).padStart(2, "0")} | ${result.top[0].absCorrelation.toFixed(3)} | ${result.margin.toFixed(3)} | ${result.sample} | ${result.top
          .map((candidate) => `0x${candidate.key.toString(16).padStart(2, "0")}`)
          .join(", ")} |`,
    ),
    "",
    "## Agent trace",
    "",
    ...state.log.map((entry) => `- ${entry.time} — ${entry.message}`),
    "",
    "## Method",
    "",
    "The agent surveyed the trace envelope, ran correlation power analysis against all 256 key hypotheses for each AES byte, ranked candidates by peak absolute correlation, and verified the recovered key against the synthetic ground truth when available.",
  ];
  return lines.join("\n");
}

function downloadReport() {
  const report = buildReport();
  if (!report) {
    return;
  }
  const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trace-reaper-report-${Date.now()}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  ui.traceCount.addEventListener("input", () => {
    ui.traceCountOutput.textContent = ui.traceCount.value;
  });
  ui.traceCount.addEventListener("change", loadSample);
  ui.noise.addEventListener("input", () => {
    ui.noiseOutput.textContent = Number(ui.noise.value).toFixed(2);
  });
  ui.noise.addEventListener("change", loadSample);
  ui.leakageModel.addEventListener("change", () => {
    if (state.dataset) {
      addLog(`model: switched to ${ui.leakageModel.value}`);
    }
  });
  ui.fileInput.addEventListener("change", (event) => {
    handleFile(event.target.files?.[0]);
  });
  ui.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    ui.dropzone.classList.add("is-dragging");
  });
  ui.dropzone.addEventListener("dragleave", () => {
    ui.dropzone.classList.remove("is-dragging");
  });
  ui.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    ui.dropzone.classList.remove("is-dragging");
    handleFile(event.dataTransfer?.files?.[0]);
  });
  for (const button of ui.runButtons) {
    button.addEventListener("click", runAgent);
  }
  for (const button of ui.resetButtons) {
    button.addEventListener("click", loadSample);
  }
  ui.downloadReport.addEventListener("click", downloadReport);
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const highlightSamples = state.results ? getHighlightSamples(state.results) : [];
      drawPlot(highlightSamples);
    }, 120);
  });
}

function init() {
  buildTables();
  makeKeyGrid();
  bindEvents();
  loadSample();
}

init();
