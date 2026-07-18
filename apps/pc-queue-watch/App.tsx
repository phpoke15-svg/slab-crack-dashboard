import { NavigationContainer, DarkTheme } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import type { RootStackParamList } from "./lib/navigation"
import { colors } from "./lib/theme"
import { QueueWatchProvider } from "./lib/queue-watch"
import InstallQueueWatcherScreen from "./screens/InstallQueueWatcherScreen"
import PointScanScreen from "./screens/PointScanScreen"
import SiteWebScreen from "./screens/SiteWebScreen"

export type { RootStackParamList } from "./lib/navigation"

const Stack = createNativeStackNavigator<RootStackParamList>()

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

export default function App() {
  return (
    <SafeAreaProvider>
      <QueueWatchProvider>
        <NavigationContainer theme={theme}>
          <StatusBar style="light" />
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: { backgroundColor: colors.card },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen
              name="Home"
              component={InstallQueueWatcherScreen}
              options={{ title: "PokeWatch", headerShown: true }}
            />
            <Stack.Screen
              name="CollecTools"
              component={SiteWebScreen}
              options={{
                title: "CollecTools",
                headerBackTitle: "Back",
              }}
            />
            <Stack.Screen
              name="PointScan"
              component={PointScanScreen}
              options={{
                title: "Point & Scan",
                headerShown: false,
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </QueueWatchProvider>
    </SafeAreaProvider>
  )
}
