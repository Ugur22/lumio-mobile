import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProviderKeyForm } from "@/components/ProviderKeyForm";
import { ProviderModelPick } from "@/components/ProviderModelPick";
import { ProviderPicker } from "@/components/ProviderPicker";
import { useSaveProvider, useTestProvider } from "@/hooks/useAddProvider";
import { cleanKey, newProfileBody, type Preset } from "@/lib/providerPresets";
import { usePalette } from "@/lib/theme";
import { useSheets } from "@/store/sheets";

type Step = "pick" | "key" | "model";

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

// Pick a provider, paste its key, then choose the model to start with. The key is only held here until it is sent.
export function AddProviderSheet() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const open = useSheets((s) => s.addProvider);
  const setOpen = useSheets((s) => s.setAddProvider);
  const test = useTestProvider();
  const save = useSaveProvider();

  const [step, setStep] = useState<Step>("pick");
  const [preset, setPreset] = useState<Preset | null>(null);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const reset = () => {
    setStep("pick");
    setPreset(null);
    setName("");
    setBaseUrl("");
    setApiKey("");
    setModels([]);
    setQuery("");
    setPicked(null);
    test.reset();
    save.reset();
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const choose = (p: Preset | null) => {
    setPreset(p);
    setName(p?.name ?? "");
    setBaseUrl(p?.baseUrl ?? "");
    setStep("key");
  };

  const back = () => {
    test.reset();
    save.reset();
    setStep(step === "model" ? "key" : "pick");
  };

  const connect = () => {
    test.mutate(
      { base_url: baseUrl.trim(), key: cleanKey(apiKey) || null, needs_key: cleanKey(apiKey) !== "" },
      {
        onSuccess: (result) => {
          setModels(result.models);
          setPicked(null);
          setStep("model");
        },
      },
    );
  };

  const finish = () => {
    if (!picked) return;
    save.mutate(newProfileBody({ name, baseUrl, model: picked, key: apiKey }), { onSuccess: close });
  };

  const title = step === "pick" ? "Add a provider" : (preset?.name ?? "Other provider");

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View className="flex-1 bg-bg" style={{ paddingBottom: insets.bottom }}>
        <View className="flex-row items-center justify-between px-5 pb-3 pt-4">
          <View className="min-w-0 flex-1 flex-row items-center gap-1">
            {step === "pick" ? null : (
              <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back">
                <ChevronLeft size={24} color={palette.accent} />
              </Pressable>
            )}
            <Text className="min-w-0 shrink text-lg font-semibold text-text" numberOfLines={1}>
              {title}
            </Text>
          </View>
          <Pressable onPress={close} hitSlop={10}>
            <Text className="text-[17px] font-medium text-accent">Cancel</Text>
          </Pressable>
        </View>

        {step === "pick" ? <ProviderPicker onPreset={choose} onCustom={() => choose(null)} /> : null}
        {step === "key" ? (
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerClassName="pb-6">
            <ProviderKeyForm
              preset={preset}
              name={name}
              baseUrl={baseUrl}
              apiKey={apiKey}
              error={test.error ? message(test.error, "Could not reach the provider") : null}
              busy={test.isPending}
              onName={setName}
              onBaseUrl={setBaseUrl}
              onKey={setApiKey}
              onSubmit={connect}
            />
          </ScrollView>
        ) : null}
        {step === "model" ? (
          <ProviderModelPick
            models={models}
            query={query}
            picked={picked}
            error={save.error ? message(save.error, "Could not save the provider") : null}
            busy={save.isPending}
            onQuery={setQuery}
            onPick={setPicked}
            onDone={finish}
          />
        ) : null}
      </View>
    </Modal>
  );
}
