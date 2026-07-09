import "./lib/queue-watch/background"
import { NavigationContainer, DarkTheme } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { StatusBar } from "expo-status-bar"
import { Text, View } from "react-native"
import type { RootTabParamList } from "./lib/navigation"
import { QueueWatchProvider, useQueueWatch } from "./lib/queue-watch"
import QueueWatchScreen from "./screens/QueueWatchScreen"
import SiteWebScreen from "./screens/SiteWebScreen"

export type { RootTabParamList } from "./lib/navigation"

const Tab = createBottomTabNavigator<RootTabParamList>()

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "#0b0e14",
    card: "#111827",
    primary: "#3b82f6",
    text: "#f9fafb",
    border: "#1f2937",
  },
}

function TabLabel({ label, focused, live }: { label: string; focused: boolean; live?: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text style={{ color: focused ? "#60a5fa" : "#6b7280", fontSize: 11, fontWeight: "700" }}>{label}</Text>
      {live && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: "#34d399",
          }}
        />
      )}
    </View>
  )
}

function AppTabs() {
  const { state, monitoring } = useQueueWatch()
  const queueLive = Boolean(state?.live)

  return (
    <Tab.Navigator
      initialRouteName="CollecTools"
      screenOptions={{
        headerStyle: { backgroundColor: "#111827" },
        headerTintColor: "#f9fafb",
        tabBarStyle: {
          backgroundColor: "#111827",
          borderTopColor: "#1f2937",
        },
        tabBarActiveTintColor: "#60a5fa",
        tabBarInactiveTintColor: "#6b7280",
      }}
    >
      <Tab.Screen
        name="CollecTools"
        component={SiteWebScreen}
        options={{
          title: "CollecTools",
          headerShown: false,
          tabBarLabel: ({ focused }) => <TabLabel label="CollecTools" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Queue"
        component={QueueWatchScreen}
        options={{
          title: "Queue Watch",
          tabBarBadge: queueLive ? "LIVE" : monitoring ? undefined : undefined,
          tabBarBadgeStyle: queueLive
            ? { backgroundColor: "#059669", color: "#fff", fontSize: 9, minWidth: 28 }
            : undefined,
          tabBarLabel: ({ focused }) => <TabLabel label="Queue" focused={focused} live={queueLive} />,
        }}
      />
    </Tab.Navigator>
  )
}

export default function App() {
  return (
    <QueueWatchProvider>
      <NavigationContainer theme={theme}>
        <StatusBar style="light" />
        <AppTabs />
      </NavigationContainer>
    </QueueWatchProvider>
  )
}
