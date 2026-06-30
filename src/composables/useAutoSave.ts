import { ref } from 'vue'

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export function useAutoSave(saveFn: () => Promise<void>, delayMs = 1000) {
  const status = ref<AutoSaveStatus>('idle')

  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingExecution: (() => Promise<void>) | null = null
  // CR-02: serialize execution. saveFn is only ever invoked through executeSave,
  // so an in-flight guard here is sufficient to prevent two concurrent saveFn
  // calls — without it, a second debounce elapsing while the first create() is
  // still awaiting would re-enter the isNew branch and create a duplicate record.
  let isRunning = false
  let rerunRequested = false

  const executeSave = async () => {
    // A save is already in flight — coalesce: remember that newer content exists
    // and re-run once after it settles. The re-run re-evaluates the caller's
    // create-vs-update decision, so the server id assigned by the first save is
    // seen and the second pass updates instead of creating again.
    if (isRunning) {
      rerunRequested = true
      return
    }
    timer = null
    pendingExecution = null
    isRunning = true
    status.value = 'saving'
    try {
      await saveFn()
      status.value = 'saved'
    } catch (e) {
      console.error('useAutoSave: save failed', e)
      status.value = 'error'
    } finally {
      isRunning = false
      if (rerunRequested) {
        rerunRequested = false
        void executeSave()
      }
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

  // CR-01: drop a pending (debounced-but-not-yet-sent) save without running it.
  // Used when the user explicitly discards changes — otherwise the flush() in the
  // consumer's onBeforeUnmount would persist the very edit they chose to discard.
  function cancel() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    pendingExecution = null
    rerunRequested = false
    status.value = 'idle'
  }

  return { status, trigger, flush, cancel }
}
