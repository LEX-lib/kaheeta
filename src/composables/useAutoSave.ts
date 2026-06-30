import { ref } from 'vue'

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export function useAutoSave(saveFn: () => Promise<void>, delayMs = 1000) {
  const status = ref<AutoSaveStatus>('idle')

  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingExecution: (() => Promise<void>) | null = null

  const executeSave = async () => {
    timer = null
    pendingExecution = null
    status.value = 'saving'
    try {
      await saveFn()
      status.value = 'saved'
    } catch {
      status.value = 'error'
    }
  }

  function debouncedSave() {
    if (timer !== null) {
      clearTimeout(timer)
    }
    pendingExecution = executeSave
    timer = setTimeout(() => {
      void executeSave()
    }, delayMs)
  }

  function trigger() {
    status.value = 'pending'
    debouncedSave()
  }

  function flush() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (pendingExecution !== null) {
      const exec = pendingExecution
      pendingExecution = null
      void exec()
    }
  }

  return { status, trigger, flush }
}
