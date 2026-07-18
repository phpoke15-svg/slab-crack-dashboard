import { useCallback } from "react"
import { Alert, BackHandler, Platform } from "react-native"
import { useFocusEffect, useNavigation, usePreventRemove } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "./navigation"

const EXIT_TITLE = "Exit CollecTools?"
const EXIT_MESSAGE = "Are you sure you want to close the app?"

function showExitAlert(onExit: () => void) {
  Alert.alert(EXIT_TITLE, EXIT_MESSAGE, [
    { text: "Cancel", style: "cancel" },
    { text: "Exit", style: "destructive", onPress: onExit },
  ])
}

type ContentExitGuardOptions = {
  contentCanGoBack: boolean
  onContentGoBack: () => void
}

/**
 * Android: hardware back walks WebView history, then native stack, then exit confirm.
 * iOS: header back / swipe-back at WebView root shows the same exit confirm.
 */
export function useAppExitGuard({ contentCanGoBack, onContentGoBack }: ContentExitGuardOptions) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const exitApp = useCallback(() => {
    if (Platform.OS === "android") {
      BackHandler.exitApp()
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return

      const onHardwareBack = () => {
        if (contentCanGoBack) {
          onContentGoBack()
          return true
        }
        if (navigation.canGoBack()) {
          navigation.goBack()
          return true
        }
        showExitAlert(exitApp)
        return true
      }

      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack)
      return () => sub.remove()
    }, [contentCanGoBack, onContentGoBack, exitApp, navigation]),
  )

  const shouldConfirmIosExit = Platform.OS === "ios" && !contentCanGoBack

  usePreventRemove(shouldConfirmIosExit, ({ data }) => {
    showExitAlert(() => {
      if (navigation.canGoBack()) {
        navigation.dispatch(data.action)
        return
      }
      exitApp()
    })
  })
}

/** Home screen: confirm before exiting when there is nowhere else to go. */
export function useHomeExitGuard() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const exitApp = useCallback(() => {
    if (Platform.OS === "android") {
      BackHandler.exitApp()
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return

      const onHardwareBack = () => {
        showExitAlert(exitApp)
        return true
      }

      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack)
      return () => sub.remove()
    }, [exitApp]),
  )

  const shouldConfirmIosExit = Platform.OS === "ios" && !navigation.canGoBack()

  usePreventRemove(shouldConfirmIosExit, ({ data }) => {
    showExitAlert(() => navigation.dispatch(data.action))
  })
}
