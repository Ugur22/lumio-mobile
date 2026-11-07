// How far from the end of the real content (px) the "scroll to latest" arrow starts to show.
export const JUMP_THRESHOLD = 80;

// True when more than `threshold` px of content lies below the visible area. `contentHeight` is the scroll view's
// content size, which leaves out the blank space (that is an inset), so the distance is to the end of the real content.
// Unmeasured sizes (0, NaN) never show the arrow.
export function jumpVisible(contentHeight: number, offset: number, viewportHeight: number, threshold = JUMP_THRESHOLD): boolean {
  if (![contentHeight, offset, viewportHeight].every(Number.isFinite) || viewportHeight <= 0 || contentHeight <= 0) return false;
  return contentHeight - (offset + viewportHeight) > threshold;
}
