import os from "node:os";
import path from "node:path";

/**
 * Server-side OCR for document photos sent on WhatsApp. On the web the phone reads
 * them; on WhatsApp the photo only reaches us, so it is read here, in memory, and
 * dropped straight after. Same engine and English data as the browser.
 */

type Worker = { recognize: (img: Buffer) => Promise<{ data: { text: string } }> };
let worker: Promise<Worker> | null = null;
// One worker reads one photo at a time; queue the rest.
let queue: Promise<unknown> = Promise.resolve();

function getWorker(): Promise<Worker> {
  worker ??= import("tesseract.js").then(({ createWorker }) =>
    createWorker("eng", 1, {
      langPath: path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int"),
      gzip: true,
      cachePath: path.join(os.tmpdir(), "udyam-ocr"),
    }),
  ) as Promise<Worker>;
  worker.catch(() => (worker = null));
  return worker;
}

export function readImage(data: Buffer): Promise<string> {
  const job = queue.then(async () => (await (await getWorker()).recognize(data)).data.text);
  queue = job.catch(() => undefined);
  return job;
}
