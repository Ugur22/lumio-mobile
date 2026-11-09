#!/usr/bin/env bash
# Prints the id of the simulator window, for screencapture -l. Newer Xcode shows simulators in "Device Hub" instead of
# "Simulator". With several windows open it takes the most portrait-shaped one (highest height/width).
# Fails when no window is on screen: sandboxed shells see no windows at all, so run it from a normal terminal tab.
id=$(swift -e '
import CoreGraphics
let windows = (CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]]) ?? []
var best: (id: Int, ratio: Double)? = nil
for w in windows {
  guard ["Simulator", "Device Hub"].contains(w["kCGWindowOwnerName"] as? String ?? ""),
        w["kCGWindowLayer"] as? Int == 0,
        let id = w["kCGWindowNumber"] as? Int,
        let b = w["kCGWindowBounds"] as? [String: Double],
        let width = b["Width"], let height = b["Height"], width > 100 else { continue }
  if best == nil || height / width > best!.ratio { best = (id, height / width) }
}
if let best = best { print(best.id) }')
[ -n "$id" ] || {
  echo "no Simulator / Device Hub window found: run from a normal terminal tab (not Claude's sandboxed shell, which sees" >&2
  echo "no windows) and keep the simulator window visible on the current Space" >&2
  exit 1
}
echo "$id"
