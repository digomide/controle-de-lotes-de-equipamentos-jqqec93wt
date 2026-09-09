import { useEffect, useRef } from 'react'
import type { RecordModel, RecordSubscription } from 'pocketbase'

import pb from '@/lib/pocketbase/client'

/**
 * Hook for real-time subscriptions to a PocketBase collection.
 * ALWAYS use this hook instead of subscribing inline.
 * Uses the per-listener UnsubscribeFunc so multiple components
 * can safely subscribe to the same collection without conflicts.
 *
 * Generic over the record type: pass your collection's interface as
 * `useRealtime<MyRecord>(...)` to get a typed subscription payload
 * instead of `unknown`.
 */
export function useRealtime<TRecord extends RecordModel = RecordModel>(
  collectionName: string,
  callback: (data: RecordSubscription<TRecord>) => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let cancelled = false
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined
    let attempt = 0

    // Backoff exponencial: 1s, 2s, 4s, 8s, máx 15s
    const getBackoffDelay = (retryCount: number) => {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 15000)
      return delay
    }

    const isPageActive = () => {
      if (typeof document === 'undefined') return true
      return document.visibilityState !== 'hidden'
    }

    const connect = () => {
      if (cancelled || !enabled) return

      // Não reinscrever se a janela estiver inativa
      if (!isPageActive()) {
        return
      }

      pb.collection<TRecord>(collectionName)
        .subscribe('*', (e) => {
          // Reset de tentativas em caso de evento recebido com sucesso
          attempt = 0
          callbackRef.current(e)
        })
        .then((fn) => {
          if (cancelled) {
            fn().catch(() => {})
          } else {
            unsubscribeFn = fn
            attempt = 0
          }
        })
        .catch((err) => {
          if (cancelled) return
          // Agendar reconexão com backoff se o componente ainda estiver montado e janela ativa
          const delay = getBackoffDelay(attempt)
          attempt++
          console.warn(
            `[useRealtime] Falha na conexão SSE para "${collectionName}". Tentando novamente em ${delay}ms (tentativa ${attempt}):`,
            err?.message || err,
          )
          reconnectTimeout = setTimeout(() => {
            if (!cancelled && isPageActive()) {
              connect()
            }
          }, delay)
        })
    }

    connect()

    const handleVisibilityChange = () => {
      if (cancelled || !enabled) return
      if (isPageActive()) {
        // Se a página voltou a ficar visível e não temos unsubscribeFn ativo
        if (!unsubscribeFn) {
          attempt = 0
          connect()
        }
      } else {
        // Janela inativa: desinscrever para poupar conexões SSE e evitar loop
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout)
          reconnectTimeout = undefined
        }
        if (unsubscribeFn) {
          const fn = unsubscribeFn
          unsubscribeFn = undefined
          fn().catch(() => {})
        }
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      cancelled = true
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [collectionName, enabled])
}

export default useRealtime
