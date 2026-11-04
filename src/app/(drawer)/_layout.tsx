import { Drawer } from "expo-router/drawer";

import { ChatDrawer } from "@/components/ChatDrawer";

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <ChatDrawer navigation={props.navigation} />}
      screenOptions={{ headerShown: false, drawerType: "front", drawerStyle: { width: "82%" }, swipeEdgeWidth: 40 }}
    >
      <Drawer.Screen name="index" />
    </Drawer>
  );
}
