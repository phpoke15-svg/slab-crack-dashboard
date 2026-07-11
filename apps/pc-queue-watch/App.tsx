import "./lib/queue-watch/background"
import { NavigationContainer, DarkTheme } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { StatusBar } from "expo-status-bar"
import { Text, View } from "react-native"
import type { RootTabParamList } from "./lib/navigation"
import { colors } from "./lib/theme"
import { QueueWatchProvider, useQueueWatch } from "./lib/queue-watch"
import QueueWatchScreen from "./screens/QueueWatchScreen"
import SiteWebScreen from "./screens/SiteWebScreen"

export type { RootTabParamList } from "./lib/navigation"

const Tab = createBottomTabNavigator<RootTabParamList>()

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.card,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
    notification: colors.primaryStrong,
  },
}

function TabLabel({ label, focused, live }: { label: string; focused: boolean; live?: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text
        style={{
          color: focused ? colors.primary : colors.textDim,
          fontSize: 11,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
      {live && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.live,
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
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
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
            ? { backgroundColor: colors.primaryDark, color: colors.white, fontSize: 9, minWidth: 28 }
            : undefined,
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Queue" focused={focused} live={queueLive} />
          ),
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
