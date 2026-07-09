import type { NavigatorScreenParams } from "@react-navigation/native"

export type ToolsStackParamList = {
  ToolsHome: undefined
  Tool: { path: string; name: string }
}

export type RootTabParamList = {
  Home: undefined
  Queue: undefined
  Tools: NavigatorScreenParams<ToolsStackParamList>
}
