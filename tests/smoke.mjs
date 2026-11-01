import fs from "node:fs";
import vm from "node:vm";
import { performance } from "node:perf_hooks";

const KEY = Uint8Array.from([
  0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6,
  0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c,
]);
const TRACE_COUNT = 180;
const SAMPLE_COUNT = 420;
const NOISE = 0.85;

function multiplyGF(a, b) {
  let result = 0;
  let left = a;
  let right = b;
  for (let index = 0; index < 8; index += 1) {
    if (right & 1) result ^= left;
    const highBit = left & 0x80;
    left = (left << 1) & 0xff;
    if (highBit) left ^= 0x1b;
    right >>= 1;
  }
  return result;
}

function powerGF(value, exponent) {
  let result = 1;
  let base = value;
  let power = exponent;
  while (power > 0) {
    if (power & 1) result = multiplyGF(result, base);
    base = multiplyGF(base, base);
    power >>= 1;
  }
  return result;
}

function rotateLeft8(value, shift) {
  return ((value << shift) | (value >> (8 - shift))) & 0xff;
}

function buildSbox() {
  const result = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    const inverse = value === 0 ? 0 : powerGF(value, 254);
    result[value] =
      inverse ^
      rotateLeft8(inverse, 1) ^
      rotateLeft8(inverse, 2) ^
      rotateLeft8(inverse, 3) ^
      rotateLeft8(inverse, 4) ^
      0x63;
  }
  return result;
}

function buildHamming() {
  const result = new Uint8Array(256);
  for (let value = 0; value < 256; value += 1) {
    let bits = value;
    while (bits) {
      result[value] += bits & 1;
      bits >>>= 1;
    }
  }
  return result;
}

let gaussianCache = null;
function gaussian() {
  if (gaussianCache !== null) {
    const value = gaussianCache;
    gaussianCache = null;
    return value;
  }
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const magnitude = Math.sqrt(-2 * Math.log(u));
  const angle = 2 * Math.PI * v;
  gaussianCache = magnitude * Math.sin(angle);
  return magnitude * Math.cos(angle);
}

function generate(sbox, hamming) {
  const plaintexts = new Uint8Array(TRACE_COUNT * 16);
  const traces = new Float32Array(TRACE_COUNT * SAMPLE_COUNT);
  const spacing = Math.floor((SAMPLE_COUNT - 56) / 16);
  const positions = Array.from({ length: 16 }, (_, index) => 30 + index * spacing);

  for (let traceIndex = 0; traceIndex < TRACE_COUNT; traceIndex += 1) {
    const plaintextOffset = traceIndex * 16;
    const traceOffset = traceIndex * SAMPLE_COUNT;
    for (let byteIndex = 0; byteIndex < 16; byteIndex += 1) {
      plaintexts[plaintextOffset + byteIndex] = Math.floor(Math.random() * 256);
    }
    for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
      const drift =
        0.12 * Math.sin(sampleIndex * 0.071 + traceIndex * 0.13) +
        0.05 * Math.sin(sampleIndex * 0.219 + traceIndex * 0.41);
      traces[traceOffset + sampleIndex] = gaussian() * NOISE + drift;
    }
    for (let byteIndex = 0; byteIndex < 16; byteIndex += 1) {
      const plaintextByte = plaintexts[plaintextOffset + byteIndex];
      const sboxValue = sbox[plaintextByte ^ KEY[byteIndex]];
      const signal = (hamming[sboxValue] - 4) * 2.8;
      const position = positions[byteIndex];
      traces[traceOffset + position] += signal;
      if (position > 0) traces[traceOffset + position - 1] += signal * 0.18;
      if (position + 1 < SAMPLE_COUNT) {
        traces[traceOffset + position + 1] += signal * 0.32;
      }
    }
  }
  return { plaintexts, traces };
}

const sbox = buildSbox();
const hamming = buildHamming();
const { plaintexts, traces } = generate(sbox, hamming);
const messages = [];
const self = {
  onmessage: null,
  postMessage(message) {
    messages.push(message);
  },
};

const workerCode = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
vm.runInNewContext(workerCode, { self, performance });
self.onmessage({
  data: {
    type: "analyze",
    plaintexts,
    traces,
    traceCount: TRACE_COUNT,
    sampleCount: SAMPLE_COUNT,
    model: "hamming",
  },
});

const done = messages.find((message) => message.type === "done");
if (!done) {
  throw new Error("Worker did not return a done message.");
}
const recovered = Uint8Array.from(done.results.map((result) => result.key));
const matches = recovered.reduce(
  (count, value, index) => count + (value === KEY[index] ? 1 : 0),
  0,
);
const hex = Array.from(recovered, (value) => value.toString(16).padStart(2, "0")).join("");

console.log(
  JSON.stringify(
    {
      traces: TRACE_COUNT,
      samples: SAMPLE_COUNT,
      noise: NOISE,
      matches,
      recovered: hex,
      runtimeMs: Math.round(done.runtimeMs),
    },
    null,
    2,
  ),
);

if (matches !== 16) {
  throw new Error(`Expected 16/16 bytes, recovered ${matches}/16.`);
}
