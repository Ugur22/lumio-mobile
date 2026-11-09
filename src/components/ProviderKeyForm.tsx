import * as Clipboard from "expo-clipboard";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { cleanKey, hostOf, validBaseUrl, type Preset } from "@/lib/providerPresets";
import { usePalette } from "@/lib/theme";

interface Props {
  // The chosen preset, or null for "Other", where the person types the address.
  preset: Preset | null;
  name: string;
  baseUrl: string;
  apiKey: string;
  error: string | null;
  busy: boolean;
  onName: (v: string) => void;
  onBaseUrl: (v: string) => void;
  onKey: (v: string) => void;
  onSubmit: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1">
      <Text className="px-1 text-xs font-semibold uppercase text-muted">{label}</Text>
      {children}
    </View>
  );
}

const input = "rounded-xl border border-border bg-surface px-4 py-3 text-[16px] text-text";

export function ProviderKeyForm({ preset, name, baseUrl, apiKey, error, busy, onName, onBaseUrl, onKey, onSubmit }: Props) {
  const palette = usePalette();
  const [shown, setShown] = useState(false);
  // A custom server may need no key; a preset always does.
  const keyOptional = preset === null;
  // An empty answer means nothing was copied, or iOS paste permission was denied; either way the field stays as it is.
  const paste = async () => {
    const text = cleanKey(await Clipboard.getStringAsync());
    if (text) onKey(text);
  };
  const ready = name.trim() !== "" && validBaseUrl(baseUrl) && (keyOptional || cleanKey(apiKey) !== "");

  return (
    <View className="gap-4 px-4">
      {preset === null ? (
        <Field label="Base URL">
          <TextInput
            className={input}
            value={baseUrl}
            onChangeText={onBaseUrl}
            placeholder="https://api.example.com/v1"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="url"
          />
        </Field>
      ) : null}

      <Field label={keyOptional ? "API key (optional)" : "API key"}>
        <View className="flex-row items-center rounded-xl border border-border bg-surface">
          <TextInput
            className="min-w-0 flex-1 px-4 py-3 text-[16px] text-text"
            value={apiKey}
            onChangeText={onKey}
            placeholder="Paste your key"
            placeholderTextColor={palette.muted}
            secureTextEntry={!shown}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="password"
            accessibilityLabel="API key"
          />
          <Pressable onPress={() => setShown((s) => !s)} hitSlop={8} accessibilityLabel={shown ? "Hide key" : "Show key"} className="px-2">
            {shown ? <EyeOff size={18} color={palette.muted} /> : <Eye size={18} color={palette.muted} />}
          </Pressable>
          <Pressable onPress={() => void paste()} hitSlop={6} accessibilityRole="button" className="mr-2 rounded-full border border-border bg-panel px-3 py-1">
            <Text className="text-[13px] font-semibold text-accent">Paste</Text>
          </Pressable>
        </View>
        {preset ? (
          <Pressable onPress={() => void Linking.openURL(preset.keyUrl)} hitSlop={6} accessibilityRole="link">
            <Text className="px-1 pt-1 text-[13px] text-accent">Where do I find my key?</Text>
          </Pressable>
        ) : (
          <Text className="px-1 pt-1 text-[13px] text-muted">Leave it empty for a server that needs no key.</Text>
        )}
      </Field>

      <Field label="Name">
        <TextInput className={input} value={name} onChangeText={onName} maxLength={60} accessibilityLabel="Name" />
      </Field>

      {preset ? (
        <Text className="px-1 text-[13px] text-muted">Address: {hostOf(preset.baseUrl)}</Text>
      ) : null}

      {error ? (
        <View accessibilityRole="alert" className="rounded-[10px] border-l-[3px] border-warn-bar bg-warn-bg px-3 py-2.5">
          <Text className="text-[13px] text-text">{error}</Text>
        </View>
      ) : null}

      <Button label="Connect" onPress={onSubmit} disabled={!ready} busy={busy} />
    </View>
  );
}
