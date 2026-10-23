/* global importScripts, FaceMesh */
importScripts('./face_mesh.js');
let tracker;
let canvas;
let landmarks = [];

/**
 * Run a single inference off the UI thread. The caller sends one frame at a time.
 * @param {MessageEvent} event Initialization settings or a transferred ImageBitmap.
 * @returns {Promise<void>} A ready/result/error message; no frame image is returned.
 * @example self.onmessage({ data: { type: 'frame', image: bitmap } });
 */
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      tracker = new FaceMesh({ locateFile: (file) => `${data.assetBase}/${file.replace('face_mesh_solution_simd_wasm_bin.js', 'face_mesh_solution_wasm_bin.js').replace('face_mesh_solution_simd_wasm_bin.wasm', 'face_mesh_solution_wasm_bin.wasm')}` });
      tracker.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5, useCpuInference: data.useCpuInference });
      tracker.onResults((results) => {
        landmarks = results.multiFaceLandmarks;
        if (results.image instanceof ImageBitmap) results.image.close();
      });
      await tracker.initialize();
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        canvas ??= new OffscreenCanvas(data.image.width, data.image.height);
        if (canvas.width !== data.image.width) canvas.width = data.image.width;
        if (canvas.height !== data.image.height) canvas.height = data.image.height;
        canvas.getContext('2d').drawImage(data.image, 0, 0);
      } finally {
        data.image.close();
      }
      landmarks = [];
      await tracker.send({ image: canvas });
      self.postMessage({ type: 'result', multiFaceLandmarks: landmarks });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error) });
  }
};
