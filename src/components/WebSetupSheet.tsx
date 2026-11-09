import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useProfiles } from "@/hooks/useProfiles";
import { hasOwnProvider } from "@/lib/trial";
import { useSession } from "@/store/session";
import { useSheets } from "@/store/sheets";

const STEPS = [
  "Open your Lumio address on a computer and sign in.",
  "Choose Providers in the menu, then Add.",
  "Come back here and tap Check again.",
];

// For people who would rather type the key on a computer: the provider is saved on the server, so it appears here.
export function WebSetupSheet() {
  const insets = useSafeAreaInsets();
  const open = useSheets((s) => s.webSetup);
  const setOpen = useSheets((s) => s.setWebSetup);
  const server = useSession((s) => s.server);
  const profiles = useProfiles();
  const [missing, setMissing] = useState(false);

  const close = () => {
    setOpen(false);
    setMissing(false);
  };

  const check = async () => {
    const { data } = await profiles.refetch();
    if (data && hasOwnProvider(data)) return close();
    setMissing(true);
  };

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View className="flex-1 gap-4 bg-bg px-5 pt-4" style={{ paddingBottom: insets.bottom + 8 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-text">Set up on the web</Text>
          <Pressable onPress={close} hitSlop={10}>
            <Text className="text-[17px] font-medium text-accent">Done</Text>
          </Pressable>
        </View>
        <Text className="text-[15px] leading-[22px] text-muted">
          Prefer a keyboard? Add the provider in the web app. It shows up here on its own.
        </Text>
        <View className="gap-3">
          {STEPS.map((step, i) => (
            <View key={step} className="flex-row items-start gap-3">
              <View className="h-6 w-6 items-center justify-center rounded-full border border-border bg-panel">
                <Text className="text-xs font-semibold text-text">{i + 1}</Text>
              </View>
              <Text className="min-w-0 flex-1 text-[15px] text-text">{step}</Text>
            </View>
          ))}
        </View>
        <View className="rounded-xl border border-border bg-surface px-4 py-3">
          <Text className="text-xs font-semibold uppercase text-muted">Your Lumio address</Text>
          <Text selectable className="pt-1 text-[16px] text-text">
            {server}
          </Text>
        </View>
        <View className="flex-1" />
        {missing ? <Text className="text-center text-[13px] text-muted">No provider found yet. Add one in the web app, then check again.</Text> : null}
        <Button label="Check again" onPress={() => void check()} busy={profiles.isFetching} />
      </View>
    </Modal>
  );
}
