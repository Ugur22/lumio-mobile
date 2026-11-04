import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { usePalette } from "@/lib/theme";

interface Props {
  title: string;
  onCancel: () => void;
  onSave: (title: string) => void;
}

export function RenameDialog({ title, onCancel, onSave }: Props) {
  const palette = usePalette();
  // The parent mounts a fresh dialog per chat, so the field starts from that chat's title.
  const [value, setValue] = useState(title);
  const trimmed = value.trim();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 px-6" onPress={onCancel}>
        <Pressable className="w-full rounded-2xl bg-panel p-5" onPress={() => undefined}>
          <Text className="mb-3 text-lg font-semibold text-text">Rename chat</Text>
          <TextInput
            className="rounded-xl border border-border bg-surface px-4 py-3 text-[17px] text-text"
            value={value}
            onChangeText={setValue}
            autoFocus
            selectTextOnFocus
            maxLength={120}
            placeholderTextColor={palette.muted}
            returnKeyType="done"
            onSubmitEditing={() => trimmed && onSave(trimmed)}
          />
          <View className="mt-4 flex-row justify-end gap-5">
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text className="text-[17px] text-muted">Cancel</Text>
            </Pressable>
            <Pressable onPress={() => trimmed && onSave(trimmed)} disabled={!trimmed} hitSlop={8}>
              <Text className={trimmed ? "text-[17px] font-medium text-accent" : "text-[17px] text-muted"}>Save</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
