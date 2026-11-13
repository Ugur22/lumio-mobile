import { Canvas, PaintStyle, Picture, Skia, createPicture, type SkPicture } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { View, useColorScheme } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { MODE_FRAMES, resolvePreset, type OrbSize, type OrbState } from "thinking-orbs/engine";

import { useReduceMotion } from "@/hooks/useReduceMotion";

import { nowSeconds, useAppActive } from "./platform";

// Adapted from thinking-orbs-native (MIT, see ./LICENSE), commit 387b049 of Jakubantalik/Libraries.dev. The geometry
// comes from the same engine as the web app, so this file only turns a frame's dots into Skia draw calls. Changes: the
// theme follows the app's colour scheme and reduce motion comes from the shared hook; the label and style props are gone
// because the caller hides the orb from assistive tech.

// The still frame reduce-motion users see, the same instant as the web.
const REDUCED_MOTION_T = 0.6;

interface Props {
  state: OrbState;
  // The tuned design: 20 (inline text) or 64 (avatar).
  size?: OrbSize;
  // Render at this many dp while keeping the `size` geometry; the frame is vector circles, so it stays sharp.
  displaySize?: number;
}

export function ThinkingOrb({ state, size = 64, displaySize }: Props) {
  const dark = useColorScheme() === "dark";
  const reduced = useReduceMotion();
  const appActive = useAppActive();

  // The frame lives in a shared value, not React state: Skia redraws on write, so a frame costs one picture record and
  // one draw instead of a React render and commit per frame.
  const empty = useMemo(() => createPicture(() => {}), []);
  const picture = useSharedValue<SkPicture>(empty);

  // One paint per pass, mutated in place: a fresh paint per dot would allocate hundreds of native objects a frame.
  const paints = useMemo(() => ({ fill: Skia.Paint(), stroke: Skia.Paint() }), []);
  const rgba = useMemo(() => new Float32Array(4), []);

  const { mode, speed, opts } = useMemo(() => resolvePreset(state, size), [state, size]);
  const box = displaySize ?? size;
  const zoom = box / size;

  useEffect(() => {
    const { fill, stroke } = paints;
    fill.setAntiAlias(true);
    stroke.setAntiAlias(true);
    stroke.setStyle(PaintStyle.Stroke);
    const build = MODE_FRAMES[mode];

    const setInk = (paint: typeof fill, white: number, alpha: number) => {
      const w = Math.min(1, Math.max(0, white));
      // Quantised to 8 bits like the web's canvas painter, so both land on the same greys.
      const g = Math.round((dark ? 1 - w : w) * 255) / 255;
      rgba[0] = g;
      rgba[1] = g;
      rgba[2] = g;
      rgba[3] = alpha;
      paint.setColor(rgba);
    };

    const record = (t: number) => {
      const frame = build(size, t, opts);
      picture.value = createPicture((canvas) => {
        if (zoom !== 1) canvas.scale(zoom, zoom);
        // Lines first so nodes sit on top of their edges; dots arrive z-sorted from the engine.
        for (const l of frame.lines) {
          setInk(stroke, l.white, l.a ?? 1);
          stroke.setStrokeWidth(l.w);
          canvas.drawLine(l.x1, l.y1, l.x2, l.y2, stroke);
        }
        for (const d of frame.dots) {
          setInk(fill, d.white, d.a ?? 1);
          canvas.drawCircle(d.x, d.y, d.r, fill);
        }
      }, Skia.XYWHRect(0, 0, box, box));
    };

    if (reduced) {
      record(REDUCED_MOTION_T);
      return;
    }
    // Drawn once even when backgrounded, so the orb is never blank.
    record(nowSeconds() * speed);
    if (!appActive) return;

    let raf = 0;
    let running = true;
    const loop = () => {
      record(nowSeconds() * speed);
      if (running) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [mode, opts, size, box, zoom, dark, speed, reduced, appActive, paints, rgba, picture]);

  return (
    <View style={{ width: box, height: box }}>
      <Canvas style={{ width: box, height: box }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}
