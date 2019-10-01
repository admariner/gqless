import { Accessor, NetworkStatus } from 'gqless'
import { useMemo, useEffect } from 'react'
import { useForceUpdate } from '../hooks/useForceUpdate'
import { StackContext } from '../Query'
import { useInterceptor } from './useInterceptor'

export const useAccessors = (stack: StackContext) => {
  const accessors = useMemo(() => new Set<Accessor>(), [])

  const accessorDisposers = useMemo(() => new Map<Accessor, Function>(), [])
  const forceUpdate = useForceUpdate()

  useEffect(() => {
    return () => {
      accessorDisposers.forEach(dispose => dispose())
    }
  }, [])

  const interceptor = useInterceptor(stack)

  return {
    ...interceptor,
    accessors,
    updateAccessors(): Promise<void> | void {
      // Find all the new accessors and add to Set
      interceptor.interceptedAccessors.forEach(accessor => {
        if (accessors.has(accessor)) return

        accessors.add(accessor)
        accessorDisposers.set(
          accessor,
          // Make component update when data changes
          accessor.onDataChange(() => {
            forceUpdate()
          })
        )
      })

      const nonIdleAccessors = new Set<Accessor>()

      accessors.forEach(accessor => {
        // Locate accessors currently being fetched,
        // and add to Set
        if (interceptor.interceptedAccessors.has(accessor)) {
          if (accessor.status !== NetworkStatus.idle) {
            nonIdleAccessors.add(accessor)
          }

          return
        }

        // Remove previously used accessors, that
        // aren't required anymore
        const dispose = accessorDisposers.get(accessor)
        if (dispose) {
          accessorDisposers.delete(accessor)
          dispose()
        }
        accessors.delete(accessor)
      })

      if (nonIdleAccessors.size) {
        let resolve: Function
        const promise = new Promise<void>(r => (resolve = r))

        accessors.forEach(accessor => {
          accessor.onStatusChange.then(() => {
            accessors.delete(accessor)
            if (!accessors.size) resolve()
          })
        })

        return promise
      }
    },
  }
}
