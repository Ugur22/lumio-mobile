import { useWindowDimensions } from "react-native";
import { Drawer } from "expo-router/drawer";

import { ChatDrawer } from "@/components/ChatDrawer";

export default function DrawerLayout() {
  const { width } = useWindowDimensions();
  return (
    <Drawer
      drawerContent={(props) => <ChatDrawer navigation={props.navigation} />}
      screenOptions={{
        headerShown: false,
        // "slide" pushes the chat aside like ChatGPT instead of covering it.
        drawerType: "slide",
        drawerStyle: { width: "82%" },
        // Whole-screen swipe so opening never needs a reach to the left edge.
        swipeEdgeWidth: width,
      }}
    >
      <Drawer.Screen name="index" />
    </Drawer>
  );
}
