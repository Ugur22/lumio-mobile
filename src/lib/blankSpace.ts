// Room left under the newest turn so the sent message can sit at the top of the screen. Without both measured heights,
// or once the turn fills the viewport, there is nothing to reserve.
export function blankSpaceFor(viewport: number, userHeight: number | undefined, replyHeight: number | undefined): number {
  if (userHeight === undefined || replyHeight === undefined) return 0;
  return Math.max(0, viewport - userHeight - replyHeight);
}
