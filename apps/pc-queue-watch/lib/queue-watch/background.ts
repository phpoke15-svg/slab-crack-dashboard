import * as BackgroundFetch from "expo-background-fetch"
import * as TaskManager from "expo-task-manager"
import { verifyProAccess } from "./pro-access"
import { queueWatchService, QUEUE_WATCH_TASK } from "./service"

TaskManager.defineTask(QUEUE_WATCH_TASK, async () => {
  try {
    if (!queueWatchService.isActive()) {
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    const access = await verifyProAccess()
    if (!access.hasPro) {
      queueWatchService.stop()
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    const state = await queueWatchService.runCheck()
    return state.live
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

export async function registerQueueBackgroundTask() {
  const status = await BackgroundFetch.getStatusAsync()
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) return false

  const registered = await TaskManager.isTaskRegisteredAsync(QUEUE_WATCH_TASK)
  if (!registered) {
    await BackgroundFetch.registerTaskAsync(QUEUE_WATCH_TASK, {
      minimumInterval: 60 * 5,
      stopOnTerminate: false,
      startOnBoot: true,
    })
  }

  return true
}

export async function unregisterQueueBackgroundTask() {
  const registered = await TaskManager.isTaskRegisteredAsync(QUEUE_WATCH_TASK)
  if (registered) {
    await BackgroundFetch.unregisterTaskAsync(QUEUE_WATCH_TASK)
  }
}
