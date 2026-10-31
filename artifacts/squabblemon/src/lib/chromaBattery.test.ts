import assert from 'node:assert/strict';
import test from 'node:test';
import { createChromaRenderer } from './chromaRenderer';

type Call = { name: string; args: unknown[] };
type DrawState = { viewport: number[]; crop: number[]; texture: number[]; upload: unknown };

class TestVideo {
  constructor(public videoWidth: number, public videoHeight: number) {}
}

function canvas2d(width = 300, height = 150) {
  const calls: Call[] = [];
  const pixels = { data: new Uint8ClampedArray([32, 200, 64, 255, 100, 80, 60, 127]) };
  const context = {
    clearRect: (...args: unknown[]) => calls.push({ name: 'clearRect', args }),
    drawImage: (...args: unknown[]) => calls.push({ name: 'drawImage', args }),
    getImageData: (...args: unknown[]) => { calls.push({ name: 'getImageData', args }); return pixels; },
    putImageData: (...args: unknown[]) => calls.push({ name: 'putImageData', args }),
  };
  const canvas = { width, height, getContext: () => context } as unknown as HTMLCanvasElement;
  return { canvas, context, calls, pixels };
}

function gpuCanvas(width = 288, height = 162) {
  const calls: Call[] = [];
  const draws: DrawState[] = [];
  const state: DrawState = { viewport: [0, 0, width, height], crop: [0, 0, 0, 0], texture: [], upload: null };
  let lost = false;
  let nextObject = 0;
  const record = (name: string, args: unknown[]) => { calls.push({ name, args }); };
  const gl: Record<string, unknown> = {};
  for (const name of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'ARRAY_BUFFER',
    'STATIC_DRAW', 'FLOAT', 'TEXTURE_2D', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'LINEAR',
    'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'CLAMP_TO_EDGE', 'UNPACK_FLIP_Y_WEBGL', 'RGBA', 'UNSIGNED_BYTE', 'TRIANGLE_STRIP']) {
    gl[name] = name;
  }
  for (const name of ['shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'useProgram',
    'bindBuffer', 'bufferData', 'enableVertexAttribArray', 'vertexAttribPointer', 'bindTexture',
    'texParameteri', 'pixelStorei', 'uniform1i', 'deleteTexture', 'deleteBuffer', 'deleteProgram', 'deleteShader']) {
    gl[name] = (...args: unknown[]) => record(name, args);
  }
  for (const name of ['createShader', 'createProgram', 'createBuffer', 'createTexture']) {
    gl[name] = (...args: unknown[]) => { record(name, args); return { name, id: ++nextObject }; };
  }
  gl.getShaderParameter = () => true;
  gl.getProgramParameter = () => true;
  gl.getAttribLocation = () => 0;
  gl.getUniformLocation = (_program: unknown, name: string) => name;
  gl.isContextLost = () => lost;
  gl.uniform4f = (location: unknown, ...values: number[]) => {
    record('uniform4f', [location, ...values]);
    assert.ok(location === 'crop' || location === 'keySettings');
    if (location === 'crop') state.crop = values;
  };
  gl.viewport = (...values: number[]) => { record('viewport', values); state.viewport = values; };
  gl.texImage2D = (...args: unknown[]) => { record('texImage2D', args); state.texture = args.slice(3, 5) as number[]; };
  gl.texSubImage2D = (...args: unknown[]) => { record('texSubImage2D', args); state.upload = args.at(-1); };
  gl.drawArrays = (...args: unknown[]) => {
    record('drawArrays', args);
    draws.push({ viewport: [...state.viewport], crop: [...state.crop], texture: [...state.texture], upload: state.upload });
  };
  gl.getExtension = (name: string) => {
    record('getExtension', [name]);
    return { loseContext: () => { record('loseContext', []); lost = true; } };
  };
  // The WebGL viewport is independent of canvas resizing, including same-size
  // assignments: https://registry.khronos.org/webgl/specs/latest/1.0/#WEBGL_VIEWPORT
  const canvas = { width, height, getContext: () => gl } as unknown as HTMLCanvasElement;
  return { canvas, calls, draws, setLost: () => { lost = true; } };
}

function withMediaDom(run: (staging: ReturnType<typeof canvas2d>[]) => void) {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalVideo = Object.getOwnPropertyDescriptor(globalThis, 'HTMLVideoElement');
  const staging: ReturnType<typeof canvas2d>[] = [];
  Object.defineProperty(globalThis, 'HTMLVideoElement', { configurable: true, value: TestVideo });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: (tag: string) => {
      assert.equal(tag, 'canvas');
      const entry = canvas2d(); staging.push(entry); return entry.canvas;
    } },
  });
  try { run(staging); }
  finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalVideo) Object.defineProperty(globalThis, 'HTMLVideoElement', originalVideo);
    else Reflect.deleteProperty(globalThis, 'HTMLVideoElement');
  }
}

const named = (calls: Call[], name: string) => calls.filter(call => call.name === name);

test('GPU chroma retains every staged frame and upload while hoisting invariant state', () => withMediaDom(staging => {
  const gpu = gpuCanvas();
  let keyCalls = 0;
  const renderer = createChromaRenderer(gpu.canvas, 'green', () => { keyCalls++; });
  assert.equal(renderer?.kind, 'gpu');
  assert.equal(staging.length, 1);
  const video = new TestVideo(1920, 1080) as unknown as HTMLVideoElement;
  const crop = [.25, .125, .5, .75];
  assert.equal(gpu.draws.length, 0, 'renderer construction must not draw the first frame early');
  assert.equal(staging[0].calls.length, 0);
  for (let frame = 0; frame < 60; frame++) renderer!.draw(video, crop);

  assert.equal(keyCalls, 0, 'GPU path must not add a CPU readback/key pass');
  assert.equal(named(gpu.calls, 'uniform4f').length, 2, 'crop and key settings are each uploaded once');
  assert.equal(named(gpu.calls, 'viewport').length, 1);
  assert.equal(named(gpu.calls, 'texImage2D').length, 1);
  assert.equal(named(gpu.calls, 'texSubImage2D').length, 60);
  assert.equal(named(gpu.calls, 'drawArrays').length, 60);
  assert.deepEqual(named(gpu.calls, 'uniform4f').find(call => call.args[0] === 'crop')!.args, ['crop', 0, 0, 1, 1]);
  assert.deepEqual(named(gpu.calls, 'uniform4f').find(call => call.args[0] === 'keySettings')!.args, ['keySettings', 35, 65, 25, 0]);
  for (let frame = 0; frame < 60; frame++) {
    assert.deepEqual(staging[0].calls.slice(frame * 2, frame * 2 + 2), [
      { name: 'clearRect', args: [0, 0, 288, 162] },
      { name: 'drawImage', args: [video, 480, 135, 960, 810, 0, 0, 288, 162] },
    ]);
    assert.deepEqual(gpu.draws[frame], {
      viewport: [0, 0, 288, 162], crop: [0, 0, 1, 1], texture: [288, 162], upload: staging[0].canvas,
    });
    assert.deepEqual(named(gpu.calls, 'texSubImage2D')[frame].args,
      ['TEXTURE_2D', 0, 0, 0, 'RGBA', 'UNSIGNED_BYTE', staging[0].canvas]);
    assert.deepEqual(named(gpu.calls, 'drawArrays')[frame].args, ['TRIANGLE_STRIP', 0, 4]);
  }
  assert.equal(named(staging[0].calls, 'getImageData').length, 0);
  renderer!.dispose();
}));

test('GPU resize changes viewport/storage once and preserves canvas-source cropping', () => withMediaDom(staging => {
  const gpu = gpuCanvas();
  const renderer = createChromaRenderer(gpu.canvas, 'move-cyan', () => {});
  const source = canvas2d(640, 480).canvas;
  renderer!.draw(source);
  gpu.canvas.width = 288; gpu.canvas.height = 162;
  renderer!.draw(source);
  assert.equal(named(gpu.calls, 'viewport').length, 1, 'same-size canvas assignments preserve WebGL state');
  assert.equal(named(gpu.calls, 'texImage2D').length, 1);

  gpu.canvas.width = 400;
  renderer!.draw(source, [.125, .25, .5, .5]);
  renderer!.draw(source, [.125, .25, .5, .5]);
  gpu.canvas.height = 300;
  renderer!.draw(source);
  assert.deepEqual(named(gpu.calls, 'viewport').map(call => call.args), [
    [0, 0, 288, 162], [0, 0, 400, 162], [0, 0, 400, 300],
  ]);
  assert.equal(named(gpu.calls, 'uniform4f').length, 2, 'resizing does not reupload invariant settings');
  assert.equal(named(gpu.calls, 'texImage2D').length, 3);
  assert.equal(named(gpu.calls, 'texSubImage2D').length, 5);
  assert.equal(gpu.draws.length, 5);
  assert.deepEqual(named(staging[0].calls, 'drawImage').map(call => call.args), [
    [source, 0, 0, 640, 480, 0, 0, 288, 162],
    [source, 0, 0, 640, 480, 0, 0, 288, 162],
    [source, 80, 120, 320, 240, 0, 0, 400, 162],
    [source, 80, 120, 320, 240, 0, 0, 400, 162],
    [source, 0, 0, 640, 480, 0, 0, 400, 300],
  ]);
  assert.deepEqual(gpu.draws.map(({ viewport, crop, texture }) => ({ viewport, crop, texture })), [
    { viewport: [0, 0, 288, 162], crop: [0, 0, 1, 1], texture: [288, 162] },
    { viewport: [0, 0, 288, 162], crop: [0, 0, 1, 1], texture: [288, 162] },
    { viewport: [0, 0, 400, 162], crop: [0, 0, 1, 1], texture: [400, 162] },
    { viewport: [0, 0, 400, 162], crop: [0, 0, 1, 1], texture: [400, 162] },
    { viewport: [0, 0, 400, 300], crop: [0, 0, 1, 1], texture: [400, 300] },
  ]);
  renderer!.dispose();
}));

test('lost and disposed GPU renderers do not stage, upload, or draw more frames', () => withMediaDom(staging => {
  const gpu = gpuCanvas();
  const renderer = createChromaRenderer(gpu.canvas, 'light', () => {});
  const source = canvas2d(10, 10).canvas;
  renderer!.draw(source);
  const beforeLoss = gpu.calls.length;
  const stagedBeforeLoss = staging[0].calls.length;
  gpu.setLost();
  gpu.canvas.width = 800;
  renderer!.draw(source);
  assert.equal(gpu.calls.length, beforeLoss);
  assert.equal(staging[0].calls.length, stagedBeforeLoss);
  renderer!.dispose();
  const afterDispose = gpu.calls.length;
  renderer!.dispose();
  renderer!.draw(source);
  assert.equal(gpu.calls.length, afterDispose);
  assert.equal(staging[0].calls.length, stagedBeforeLoss);
  for (const name of ['deleteTexture', 'deleteBuffer', 'deleteProgram', 'loseContext']) {
    assert.equal(named(gpu.calls, name).length, 1, `${name} must run once`);
  }
  assert.equal(named(gpu.calls, 'deleteShader').length, 2);
  assert.equal(staging[0].canvas.width, 1);
  assert.equal(staging[0].canvas.height, 1);
}));

test('CPU fallback retains clear/crop/read/key/write order for video and canvas sources', () => withMediaDom(staging => {
  for (const preferGpu of [false, true]) {
    for (const video of [false, true]) {
      const surface = canvas2d(48, 24);
      const contextRequests: unknown[][] = [];
      surface.canvas.getContext = ((kind: string, options: unknown) => {
        contextRequests.push([kind, options]);
        return kind === 'webgl' ? null : surface.context;
      }) as typeof surface.canvas.getContext;
      const source = video
        ? new TestVideo(800, 600) as unknown as HTMLVideoElement
        : canvas2d(800, 600).canvas;
      const renderer = createChromaRenderer(surface.canvas, 'move-green', pixels => {
        assert.equal(pixels, surface.pixels.data);
        surface.calls.push({ name: 'key', args: [] });
        pixels[3] = 12;
      }, preferGpu);
      assert.equal(renderer?.kind, 'cpu');
      assert.equal(contextRequests[0][0], preferGpu ? 'webgl' : '2d');
      assert.deepEqual(contextRequests.at(-1), ['2d', { willReadFrequently: true }]);
      renderer!.draw(source, [.25, .125, .5, .75]);
      assert.deepEqual(surface.calls, [
        { name: 'clearRect', args: [0, 0, 48, 24] },
        { name: 'drawImage', args: [source, 200, 75, 400, 450, 0, 0, 48, 24] },
        { name: 'getImageData', args: [0, 0, 48, 24] },
        { name: 'key', args: [] },
        { name: 'putImageData', args: [surface.pixels, 0, 0] },
      ]);
      assert.equal(surface.pixels.data[3], 12);
      renderer!.dispose();
    }
  }
  assert.equal(staging.length, 0, 'CPU fallback must not allocate a GPU staging canvas');
}));
