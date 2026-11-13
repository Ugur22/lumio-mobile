import { MarkdownStream, type RenderRules } from "@ronradtke/react-native-markdown-display";
import { createMarkdownIt } from "@ronradtke/react-native-markdown-display";
import { Sparkles } from "lucide-react-native";
import { memo, useEffect, useMemo, useState } from "react";
import { Animated, Text, View, useColorScheme, useWindowDimensions } from "react-native";
import RenderHTML from "react-native-render-html";

import { imageSource } from "@/api/client";
import type { ImageRef } from "@/api/types";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { splitReply, type Illustration } from "@/lib/illustrations";
import { markdownStyles } from "@/lib/markdownStyles";
import { lumioMarkup } from "@/lib/markup/plugin";
import { prepare, type Segment } from "@/lib/markup/prepare";
import { sanitizeBlockHtml } from "@/lib/markup/sanitizeHtml";
import { type Palette, usePalette } from "@/lib/theme";
import { useStream } from "@/store/stream";

import { AttachedImage } from "./AttachedImage";

const NO_IMAGES: string[] = [];
const NO_LIVE: Illustration[] = [];
const markdownIt = createMarkdownIt({ plugins: [lumioMarkup] });

const rules: RenderRules = {
  dialogue: (node, children, _parent, styles) => (
    <Text key={node.key} style={styles.dialogue}>
      {children}
    </Text>
  ),
  mark: (node, children, _parent, styles) => (
    <Text key={node.key} style={styles.mark}>
      {children}
    </Text>
  ),
};

interface MarkdownPartProps {
  text: string;
  streaming: boolean;
  palette: Palette;
  dark: boolean;
  style: ReturnType<typeof markdownStyles>;
}

function MarkdownPart({ text, streaming, palette, dark, style }: MarkdownPartProps) {
  return (
    <MarkdownStream
      streaming={streaming}
      colorScheme={dark ? "dark" : "light"}
      cursorColor={palette.text}
      style={style}
      markdownit={markdownIt}
      rules={rules}
      // Reply text is untrusted: no remote images (tracking pixels), and raw HTML stays plain text here; styled
      // blocks are cut out beforehand and rendered by StyledBlock after sanitizing.
      allowedImageHandlers={NO_IMAGES}
      defaultImageHandler={null}
    >
      {text}
    </MarkdownStream>
  );
}

function StyledBlock({ html, palette }: { html: string; palette: Palette }) {
  const { width } = useWindowDimensions();
  const source = useMemo(() => ({ html: sanitizeBlockHtml(html) }), [html]);
  // The block brings its own colours; these are the fallback for text it leaves unstyled.
  const base = useMemo(() => ({ color: palette.text, fontSize: 16, lineHeight: 24 }), [palette.text]);
  return (
    <View className="my-3">
      <RenderHTML contentWidth={width - 32} source={source} baseStyle={base} />
    </View>
  );
}

function Callout({ tone, palette, children }: { tone: "note" | "warn"; palette: Palette; children: React.ReactNode }) {
  const bar = tone === "warn" ? palette.warnBar : palette.noteBar;
  return (
    <View
      className="my-3 rounded-lg border px-4"
      style={{ backgroundColor: tone === "warn" ? palette.warnBg : palette.noteBg, borderColor: `${bar}66` }}
    >
      {children}
    </View>
  );
}

// Held-back styled block while it is still being written, like the web app's drawing placeholder.
function Drawing({ palette }: { palette: Palette }) {
  const [pulse] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      accessibilityLabel="Drawing"
      className="my-3 h-32 items-end rounded-2xl border border-border bg-bubble p-3"
      style={{ opacity: pulse }}
    >
      <Text style={{ color: palette.muted, fontSize: 12 }}>Drawing…</Text>
    </Animated.View>
  );
}

function render(segment: Segment, i: number, last: boolean, streaming: boolean, shared: Omit<MarkdownPartProps, "text" | "streaming">) {
  const live = streaming && last;
  switch (segment.kind) {
    case "md":
      return <MarkdownPart key={i} text={segment.text} streaming={live} {...shared} />;
    case "callout":
      return (
        <Callout key={i} tone={segment.tone} palette={shared.palette}>
          <MarkdownPart text={segment.text} streaming={live} {...shared} />
        </Callout>
      );
    case "html":
      return <StyledBlock key={i} html={segment.html} palette={shared.palette} />;
  }
}

// Markdown, styled blocks and callouts for one stretch of reply text.
const Text_ = memo(function TextParts({ text, streaming }: { text: string; streaming: boolean }) {
  const palette = usePalette();
  const dark = useColorScheme() === "dark";
  const style = useMemo(() => markdownStyles(palette), [palette]);
  const prepared = useMemo(() => prepare(text, streaming), [text, streaming]);
  const shared = { palette, dark, style };
  const { segments, drawing } = prepared;

  // The blinking cursor belongs to the tail of the reply: with nothing yet, an empty Markdown part carries it.
  if (segments.length === 0 && !drawing) return streaming ? <MarkdownPart text="" streaming {...shared} /> : null;
  return (
    <View>
      {segments.map((s, i) => render(s, i, i === segments.length - 1 && !drawing, streaming, shared))}
      {drawing ? <Drawing palette={palette} /> : null}
    </View>
  );
});

// A picture the model asked for that has not been generated yet. Same size as AttachedImage so nothing jumps.
function Illustrating({ palette }: { palette: Palette }) {
  const [pulse] = useState(() => new Animated.Value(0.5));
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.8);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);
  return (
    <Animated.View
      accessibilityLabel="Illustrating"
      className="my-3 items-center justify-center gap-2 rounded-xl border border-border bg-bubble"
      style={{ width: 260, height: 260, opacity: pulse }}
    >
      <Sparkles size={28} color={palette.muted} />
      <Text style={{ color: palette.muted, fontSize: 14 }}>Illustrating…</Text>
    </Animated.View>
  );
}

interface ReplyProps {
  text: string;
  streaming: boolean;
  // The chat this reply belongs to and the pictures stored with it, which the text points at by id.
  chatId: string | null;
  images: readonly ImageRef[];
}

// An assistant reply: Markdown, the model's styled blocks, callouts and illustrations, in order.
export const Reply = memo(function Reply({ text, streaming, chatId, images }: ReplyProps) {
  const palette = usePalette();
  // Pictures stored while the reply is still streaming; only the turn in flight has any.
  const live = useStream((s) => (streaming ? s.images : NO_LIVE));
  const createdChatId = useStream((s) => s.createdChatId);
  const illustrate = useStream((s) => s.pending?.illustrate ?? true);
  const imageChat = chatId ?? (streaming ? createdChatId : null);
  const parts = useMemo(
    () => splitReply(text, images.map((i) => ({ id: i.id, prompt: i.prompt })), streaming, live, illustrate),
    [text, images, streaming, live, illustrate],
  );

  if (parts.length === 0) return <Text_ text="" streaming={streaming} />;
  const lastText = parts.map((p) => p.kind).lastIndexOf("text");
  return (
    <View>
      {parts.map((part, i) => {
        if (part.kind === "text") return <Text_ key={i} text={part.text} streaming={streaming && i === lastText && i === parts.length - 1} />;
        if (part.kind === "pending") return <Illustrating key={i} palette={palette} />;
        // Live and saved pictures get different keys, so when the saved message replaces the live one the image remounts
        // and loads fresh instead of keeping a failure from before the server could serve it.
        const liveKey = streaming && live.some((l) => l.id === part.illustration.id);
        return (
          <View key={`${liveKey ? "live" : "saved"}-${part.illustration.id}`} className="my-3 items-start">
            {imageChat ? (
              <AttachedImage source={imageSource(imageChat, part.illustration.id)} label={part.illustration.prompt ?? "Generated image"} size={260} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
});
