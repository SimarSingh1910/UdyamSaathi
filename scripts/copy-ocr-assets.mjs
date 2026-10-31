// Copies the OCR engine and English language data into public/ so document
// reading works fully on-device, with no third-party CDN (runs on postinstall).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "public", "tesseract");
const from = (...p) => path.join(root, "node_modules", ...p);

const files = [
  [from("tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  ...["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"].map((n) => [
    from("tesseract.js-core", `${n}.wasm.js`),
    path.join("core", `${n}.wasm.js`),
  ]),
  [from("@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), path.join("lang", "eng.traineddata.gz")],
];

for (const [src, rel] of files) {
  if (!existsSync(src)) {
    console.warn(`[ocr-assets] missing ${src}, skipping`);
    continue;
  }
  const dest = path.join(out, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}
console.log("[ocr-assets] copied to public/tesseract");
