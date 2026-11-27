import { readFile, writeFile } from "node:fs/promises";

// The legacy package's worker branch requires these API corrections.
// Keep the upstream license header and fail on version/source drift.
const base = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("node_modules/@mediapipe/face_mesh/package.json", base), "utf8"));
if (pkg.version !== "0.4.1633559619") throw new Error("Review FaceMesh worker fixes before upgrading MediaPipe");
let source = await readFile(new URL("node_modules/@mediapipe/face_mesh/face_mesh.js", base), "utf8");
const fixes = [
  ['navigator.userAgent.includes("Mac")&&"ontouchend"in document', 'navigator.userAgent.includes("Mac")&&"undefined"!==typeof document&&"ontouchend"in document'],
  ['k=d.h.GL.createContext(d.l,\n{antialias:!1,alpha:!1,ba:"undefined"!==typeof WebGL2RenderingContext?2:1});d.h.GL.makeContextCurrent(k);', 'd.D=self.initializeFaceWorkerContext(d.h,d.l);'],
];
for (const [before, after] of fixes) {
  if (source.split(before).length !== 2) throw new Error("FaceMesh worker patch no longer matches exactly once");
  source = source.replace(before, after);
}
await writeFile(new URL("public/mediapipe/face_mesh/face_mesh.js", base), source);
