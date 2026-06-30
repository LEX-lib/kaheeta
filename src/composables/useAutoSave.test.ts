import { describe, it, expect, vi } from 'vitest'
import { useAutoSave } from './useAutoSave'

describe('useAutoSave', () => {
  it('status is idle on init', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status } = useAutoSave(saveFn)
    expect(status.value).toBe('idle')
  })

  it('trigger() sets status to pending synchronously', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status, trigger } = useAutoSave(saveFn)
    trigger()
    expect(status.value).toBe('pending')
  })

  it('after flush(), saveFn is called and status becomes saved', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status, trigger, flush } = useAutoSave(saveFn)
    trigger()
    flush()
    // Wait for the async saveFn to resolve
    await vi.waitFor(() => expect(status.value).toBe('saved'))
    expect(saveFn).toHaveBeenCalledOnce()
  })

  it('after flush() with failing saveFn, status becomes error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const saveFn = vi.fn().mockRejectedValue(new Error('save failed'))
    const { status, trigger, flush } = useAutoSave(saveFn)
    trigger()
    flush()
    await vi.waitFor(() => expect(status.value).toBe('error'))
    expect(saveFn).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })

  // CR-01: discarding changes must not persist the pending edit.
  it('cancel() drops a pending save so a later flush() never runs it', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    const { status, trigger, flush, cancel } = useAutoSave(saveFn, 1000)
    trigger()
    expect(status.value).toBe('pending')
    cancel()
    expect(status.value).toBe('idle')
    // Simulate the consumer's onBeforeUnmount flush firing after a discard.
    flush()
    await Promise.resolve()
    expect(saveFn).not.toHaveBeenCalled()
  })

  // CR-02: a trigger while a save is in flight must not start a second concurrent
  // saveFn (which on the create path would produce a duplicate record). The later
  // edit is coalesced into exactly one re-run after the in-flight save settles.
  it('serializes saves — never runs saveFn concurrently, re-runs the latest once', async () => {
    const resolvers: Array<() => void> = []
    let active = 0
    let maxActive = 0
    const saveFn = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          active++
          maxActive = Math.max(maxActive, active)
          resolvers.push(() => {
            active--
            resolve()
          })
        }),
    )
    const { trigger, flush } = useAutoSave(saveFn, 1000)

    trigger()
    flush() // first save now in flight
    await Promise.resolve()
    expect(saveFn).toHaveBeenCalledTimes(1)

    trigger()
    flush() // arrives during in-flight save — must coalesce, not double-fire
    await Promise.resolve()
    expect(saveFn).toHaveBeenCalledTimes(1)
    expect(maxActive).toBe(1)

    resolvers[0]?.() // settle the first save → coalesced re-run fires
    await vi.waitFor(() => expect(saveFn).toHaveBeenCalledTimes(2))
    expect(maxActive).toBe(1)
    resolvers[1]?.()
  })
})
