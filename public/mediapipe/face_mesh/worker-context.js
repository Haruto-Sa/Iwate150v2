/**
 * Register the actual OffscreenCanvas context with the legacy Emscripten runtime.
 * Constructor presence does not establish that a WebGL version can be created.
 * @param {object} module MediaPipe's Emscripten module with its GL registry.
 * @param {OffscreenCanvas} canvas Canvas owned by this Worker.
 * @returns {WebGLRenderingContext|WebGL2RenderingContext} The registered, current context.
 * @example const context = self.initializeFaceWorkerContext(module, canvas);
 */
self.initializeFaceWorkerContext = function (module, canvas) {
  const attributes = { antialias: false, alpha: false };
  const context = canvas.getContext('webgl2', attributes) || canvas.getContext('webgl', attributes);
  if (!context) throw new DOMException('Worker WebGL is unavailable', 'NotSupportedError');
  const majorVersion = context.getParameter(context.VERSION).startsWith('WebGL 2') ? 2 : 1;
  const handle = module.GL.registerContext(context, { ...attributes, majorVersion });
  if (!handle || !module.GL.makeContextCurrent(handle)) throw new Error('Worker WebGL context could not be activated');
  return context;
};
