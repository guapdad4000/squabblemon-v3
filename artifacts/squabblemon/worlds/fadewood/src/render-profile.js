// A fixed, modest pixel budget avoids allocating a phone's full 3x/4x panel.
// Compact NPC assets are shared by every profile; resizing only reapplies pixelRatio.
export function getRenderProfile({
  width = 1280,
  height = 720,
  devicePixelRatio = 1,
  coarsePointer = false,
  deviceMemory = null,
} = {}) {
  const viewportWidth = Number.isFinite(width) && width > 0 ? width : 1280;
  const viewportHeight = Number.isFinite(height) && height > 0 ? height : 720;
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const mobile = Boolean(coarsePointer) || viewportWidth <= 900;
  const lowMemory = Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 4;
  const cap = lowMemory ? 1 : mobile ? 1.25 : 1.5;
  return Object.freeze({
    name: `${mobile ? 'mobile' : 'desktop'}${lowMemory ? '-low' : ''}`,
    mobile,
    lowMemory,
    pixelRatio: Math.min(dpr, cap),
    antialias: !mobile && !lowMemory,
    characterAssetDirectory: 'characters-mobile',
    viewportWidth,
    viewportHeight,
  });
}
