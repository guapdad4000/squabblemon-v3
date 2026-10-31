export type ChromaMode = 'green' | 'light' | 'move-green' | 'move-cyan' | 'move-none';
type MediaSource = HTMLVideoElement | HTMLCanvasElement;
type KeySettings = { threshold: number; feather: number; spill: number; edgeFeather: number };

/** Softens only the outer frame edge; the central character and impact stay intact. */
export function featherChromaEdges(pixels: Uint8ClampedArray, width: number, height: number, edge: number) {
  if (edge <= 0) return;
  const band = Math.ceil(width * edge);
  for (let y = 0; y < height; y++) {
    const rowDistance = Math.min(y + .5, height - y - .5) / height;
    for (let x = 0; x < width; x++) {
      // Most rows need only two narrow edge strips; skip the unchanged center.
      if (rowDistance >= edge && x === band) x = Math.max(x, width - band);
      if (x >= width) break;
      const distance = Math.min((x + .5) / width, (width - x - .5) / width, rowDistance);
      if (distance >= edge) continue;
      const t = Math.max(0, distance / edge);
      const offset = (y * width + x) * 4 + 3;
      pixels[offset] = Math.round(pixels[offset] * t * t * (3 - 2 * t));
    }
  }
}

/** Same byte-domain key as the CPU fallback, without a GPU → CPU readback per frame. */
export function createChromaRenderer(canvas: HTMLCanvasElement, mode: ChromaMode, keyPixels: (pixels: Uint8ClampedArray) => void, preferGpu = true, settings?: KeySettings) {
  const gl = preferGpu ? canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }) : null;
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
        if (settings?.edgeFeather) featherChromaEdges(pixels.data, canvas.width, canvas.height, settings.edgeFeather);
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
    uniform vec4 keySettings;
    varying vec2 uv;
    void main() {
      vec4 pixel = texture2D(frame, uv);
      vec3 rgb = floor(pixel.rgb * 255.0 + 0.5);
      float alpha = 1.0;
      if (mode == 1) {
        alpha = clamp((232.0 - dot(rgb, vec3(0.299, 0.587, 0.114))) / 82.0, 0.0, 1.0);
      } else if (mode != 4) {
        float dominance = mode == 3 ? min(rgb.g, rgb.b) - rgb.r : rgb.g - max(rgb.r, rgb.b);
        alpha = 1.0 - clamp((dominance - (mode == 0 ? 16.0 : keySettings.x)) / (mode == 0 ? 52.0 : keySettings.y), 0.0, 1.0);
        if (alpha > 0.0) {
          float spillFloor = mode == 2 && keySettings.w > 0.0 ? max(rgb.r, rgb.b) : rgb.r;
          rgb.g = mode == 0 ? min(rgb.g, max(rgb.r, rgb.b) + 10.0) : floor(mix(min(rgb.g, spillFloor + keySettings.z), rgb.g, alpha) + 0.5);
          if (mode == 3) rgb.b = floor(mix(min(rgb.b, rgb.r + keySettings.z), rgb.b, alpha) + 0.5);
        }
      }
      float a = floor(pixel.a * alpha * 255.0 + 0.5) / 255.0;
      if (keySettings.w > 0.0) {
        float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
        a = floor(a * smoothstep(0.0, keySettings.w, edge) * 255.0 + 0.5) / 255.0;
      }
      // Premultiplied output: iOS WebKit mis-composites unpremultiplied WebGL canvases.
      gl_FragColor = vec4(rgb / 255.0 * a, a);
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
  gl.uniform4f(gl.getUniformLocation(program, 'keySettings'), settings?.threshold ?? 35, settings?.feather ?? 65, settings?.spill ?? 25, settings?.edgeFeather ?? 0);
  const cropUniform = gl.getUniformLocation(program, 'crop');
  // Cropping is performed by the staging canvas; GPU UVs always cover it all.
  gl.uniform4f(cropUniform, 0, 0, 1, 1);
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
      if (textureWidth !== canvas.width || textureHeight !== canvas.height) {
        textureWidth = canvas.width; textureHeight = canvas.height;
        gl.viewport(0, 0, textureWidth, textureHeight);
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
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      staging.width = staging.height = 1;
    },
  };
}
