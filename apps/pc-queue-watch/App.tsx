import "./lib/queue-watch/background"
import { NavigationContainer, DarkTheme } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import type { NavigatorScreenParams } from "@react-navigation/native"
import { StatusBar } from "expo-status-bar"
import { Text, View } from "react-native"
import { QueueWatchProvider, useQueueWatch } from "./lib/queue-watch"
import HomeScreen from "./screens/HomeScreen"
import QueueWatchScreen from "./screens/QueueWatchScreen"
import ToolsHomeScreen from "./screens/ToolsHomeScreen"
import ToolWebScreen from "./screens/ToolWebScreen"

export type ToolsStackParamList = {
  ToolsHome: undefined
  Tool: { path: string; name: string }
}

export type RootTabParamList = {
  Home: undefined
  Queue: undefined
  Tools: NavigatorScreenParams<ToolsStackParamList>
}

const Tab = createBottomTabNavigator<RootTabParamList>()
const ToolsStack = createNativeStackNavigator<ToolsStackParamList>()

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

function ToolsNavigator() {
  return (
    <ToolsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#111827" },
        headerTintColor: "#f9fafb",
        contentStyle: { backgroundColor: "#0b0e14" },
      }}
    >
      <ToolsStack.Screen name="ToolsHome" component={ToolsHomeScreen} options={{ title: "Tools" }} />
      <ToolsStack.Screen
        name="Tool"
        component={ToolWebScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
    </ToolsStack.Navigator>
  )
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
        name="Home"
        component={HomeScreen}
        options={{
          title: "CollecTools",
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />,
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
      <Tab.Screen
        name="Tools"
        component={ToolsNavigator}
        options={{
          headerShown: false,
          tabBarLabel: ({ focused }) => <TabLabel label="Tools" focused={focused} />,
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
