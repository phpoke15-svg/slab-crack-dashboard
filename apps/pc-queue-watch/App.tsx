import { useEffect } from "react"
import { Linking } from "react-native"
import * as Notifications from "expo-notifications"
import { NavigationContainer, DarkTheme } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import type { RootStackParamList } from "./lib/navigation"
import { colors } from "./lib/theme"
import { QueueWatchProvider } from "./lib/queue-watch"
import {
  extractQueueUrlFromNotificationData,
} from "./lib/push/remote-alerts"
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
  useEffect(() => {
    const openQueueUrl = (url: string) => {
      void Linking.openURL(url)
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined
      const url =
        extractQueueUrlFromNotificationData(data) ?? "https://www.pokemoncenter.com/"
      openQueueUrl(url)
    })

    return () => {
      subscription.remove()
    }
  }, [])

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
              component={SiteWebScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PokeWatch"
              component={InstallQueueWatcherScreen}
              options={{ headerShown: false }}
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
