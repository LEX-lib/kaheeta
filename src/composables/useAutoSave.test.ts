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
    const saveFn = vi.fn().mockRejectedValue(new Error('save failed'))
    const { status, trigger, flush } = useAutoSave(saveFn)
    trigger()
    flush()
    await vi.waitFor(() => expect(status.value).toBe('error'))
    expect(saveFn).toHaveBeenCalledOnce()
  })
})
