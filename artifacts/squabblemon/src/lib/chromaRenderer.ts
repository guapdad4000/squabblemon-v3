export type ChromaMode = 'green' | 'light' | 'move-green' | 'move-cyan' | 'move-none';
type MediaSource = HTMLVideoElement | HTMLCanvasElement;

/** Same byte-domain key as the CPU fallback, without a GPU → CPU readback per frame. */
export function createChromaRenderer(canvas: HTMLCanvasElement, mode: ChromaMode, keyPixels: (pixels: Uint8ClampedArray) => void, preferGpu = true) {
  const gl = preferGpu ? canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false }) : null;
  if (!gl) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    return {
      kind: 'cpu' as const,
      draw(source: MediaSource, crop = [0, 0, 1, 1]) {
        const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
        const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, crop[0] * width, crop[1] * height, crop[2] * width, crop[3] * height, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        keyPixels(pixels.data);
        context.putImageData(pixels, 0, 0);
      },
      dispose() {},
    };
  }

  const shader = (type: number, source: string) => {
    const result = gl.createShader(type)!;
    gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) { gl.deleteShader(result); throw new Error('Chroma shader compilation failed'); }
    return result;
  };
  const vertex = shader(gl.VERTEX_SHADER, `
    attribute vec2 position;
    varying vec2 uv;
    uniform vec4 crop;
    void main() { uv = crop.xy + (position * 0.5 + 0.5) * crop.zw; gl_Position = vec4(position, 0.0, 1.0); }
  `);
  const fragment = shader(gl.FRAGMENT_SHADER, `
    precision highp float;
    uniform sampler2D frame;
    uniform int mode;
    varying vec2 uv;
    void main() {
      vec4 pixel = texture2D(frame, uv);
      vec3 rgb = floor(pixel.rgb * 255.0 + 0.5);
      float alpha = 1.0;
      if (mode == 1) {
        alpha = clamp((232.0 - dot(rgb, vec3(0.299, 0.587, 0.114))) / 82.0, 0.0, 1.0);
      } else if (mode != 4) {
        float dominance = mode == 3 ? min(rgb.g, rgb.b) - rgb.r : rgb.g - max(rgb.r, rgb.b);
        alpha = 1.0 - clamp((dominance - (mode == 0 ? 16.0 : 35.0)) / (mode == 0 ? 52.0 : 65.0), 0.0, 1.0);
        if (alpha > 0.0) {
          rgb.g = mode == 0 ? min(rgb.g, max(rgb.r, rgb.b) + 10.0) : floor(mix(min(rgb.g, rgb.r + 25.0), rgb.g, alpha) + 0.5);
          if (mode == 3) rgb.b = floor(mix(min(rgb.b, rgb.r + 25.0), rgb.b, alpha) + 0.5);
        }
      }
      gl_FragColor = vec4(rgb / 255.0, floor(pixel.a * alpha * 255.0 + 0.5) / 255.0);
    }
  `);
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Chroma shader linking failed');
  gl.useProgram(program);
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.uniform1i(gl.getUniformLocation(program, 'frame'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'mode'), ['green', 'light', 'move-green', 'move-cyan', 'move-none'].indexOf(mode));
  const cropUniform = gl.getUniformLocation(program, 'crop');
  const staging = document.createElement('canvas');
  const stagingContext = staging.getContext('2d')!;
  let textureWidth = 0, textureHeight = 0;
  let disposed = false;
  return {
    kind: 'gpu' as const,
    draw(source: MediaSource, crop = [0, 0, 1, 1]) {
      if (disposed || gl.isContextLost()) return;
      // Preserve drawImage's crop/resampling exactly, and upload only the
      // displayed effect size rather than a full HD source on every frame.
      if (staging.width !== canvas.width || staging.height !== canvas.height) {
        staging.width = canvas.width; staging.height = canvas.height;
      }
      const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
      stagingContext.clearRect(0, 0, staging.width, staging.height);
      stagingContext.drawImage(source, crop[0] * width, crop[1] * height, crop[2] * width, crop[3] * height, 0, 0, staging.width, staging.height);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform4f(cropUniform, 0, 0, 1, 1);
      if (textureWidth !== canvas.width || textureHeight !== canvas.height) {
        textureWidth = canvas.width; textureHeight = canvas.height;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, staging);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      staging.width = staging.height = 1;
    },
  };
}
