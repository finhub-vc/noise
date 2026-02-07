/**
 * Real-time updates hook using HTTP polling
 *
 * NOTE: This uses HTTP polling instead of WebSocket because Cloudflare Workers
 * don't support direct WebSocket connections from server to browser clients.
 * Polls positions and signals every 3 seconds.
 *
 * TODO: Rename to usePollingUpdates once we migrate to a proper WebSocket server.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface WebSocketConfig {
  enabled?: boolean;
  reconnectInterval?: number;
}

export interface WebSocketStatus {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
}

type MessageHandler = (data: unknown) => void;
type ConnectionChangeHandler = (connected: boolean) => void;

export function useWebSocket(config: WebSocketConfig = {}) {
  const { enabled = true, reconnectInterval = 5000 } = config;

  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    connecting: false,
    error: null,
  });

  const messageHandlers = useRef(new Set<MessageHandler>());
  const connectionHandlers = useRef(new Set<ConnectionChangeHandler>());
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Connect to real-time updates
  const connect = useCallback(() => {
    if (!enabled) {
      return;
    }

    setStatus({ connected: false, connecting: true, error: null });

    // Since Cloudflare Workers don't support WebSocket from server to browser directly,
    // we use polling as a fallback
    try {
      // Start polling for updates
      pollingIntervalRef.current = setInterval(async () => {
        try {
          // Poll for position updates
          const positionsResponse = await fetch('/api/positions');
          if (positionsResponse.ok) {
            const positionsData = await positionsResponse.json();
            notifyHandlers({ type: 'positions', data: positionsData });
          }

          // Poll for signal updates
          const signalsResponse = await fetch('/api/signals/active');
          if (signalsResponse.ok) {
            const signalsData = await signalsResponse.json();
            notifyHandlers({ type: 'signals', data: signalsData });
          }

          if (!status.connected) {
            setStatus({ connected: true, connecting: false, error: null });
            notifyConnectionChange(true);
          }
        } catch (error) {
          setStatus((prev) => ({ ...prev, connected: false, error: error as Error }));
          notifyConnectionChange(false);
        }
      }, 3000); // Poll every 3 seconds

      setStatus({ connected: true, connecting: false, error: null });
      notifyConnectionChange(true);
    } catch (error) {
      setStatus({ connected: false, connecting: false, error: error as Error });
      notifyConnectionChange(false);
    }
  }, [enabled]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setStatus({ connected: false, connecting: false, error: null });
    notifyConnectionChange(false);
  }, []);

  // Send message (not supported in polling mode)
  // @deprecated This function does nothing in polling mode. Will be removed when WebSocket is implemented.
  const send = useCallback((_data: unknown) => {
    // Placeholder - not supported in polling mode
    console.warn('send() is not supported in polling mode. This is a no-op.');
  }, []);

  // Register message handler
  const onMessage = useCallback((handler: MessageHandler): (() => void) => {
    messageHandlers.current.add(handler);
    return () => {
      messageHandlers.current.delete(handler);
    };
  }, []);

  // Register connection change handler
  const onConnectionChange = useCallback((handler: ConnectionChangeHandler): (() => void) => {
    connectionHandlers.current.add(handler);
    return () => {
      connectionHandlers.current.delete(handler);
    };
  }, []);

  // Notify all handlers
  const notifyHandlers = useCallback((data: unknown) => {
    messageHandlers.current.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error('WebSocket handler error:', error);
      }
    });
  }, []);

  const notifyConnectionChange = useCallback((connected: boolean) => {
    connectionHandlers.current.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        console.error('Connection change handler error:', error);
      }
    });
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Auto-reconnect on error
  useEffect(() => {
    if (status.error && !status.connecting) {
      const timer = setTimeout(() => {
        connect();
      }, reconnectInterval);

      return () => clearTimeout(timer);
    }
  }, [status.error, status.connecting, connect, reconnectInterval]);

  return {
    ...status,
    connect,
    disconnect,
    send,
    onMessage,
    onConnectionChange,
  };
}

/**
 * Hook for real-time position updates
 */
export function useRealtimePositions() {
  const [positions, setPositions] = useState<Array<{
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    entry_price: number;
    current_price?: number;
    unrealized_pnl?: number;
  }>>([]);

  const { onMessage, connected } = useWebSocket({ enabled: true });

  useEffect(() => {
    const unsubscribe = onMessage((data: unknown) => {
      if ((data as { type?: string }).type === 'positions') {
        const positionsData = (data as { data?: { positions?: unknown } }).data;
        if (positionsData?.positions && Array.isArray(positionsData.positions)) {
          setPositions(positionsData.positions as typeof positions);
        }
      }
    });

    return unsubscribe;
  }, [onMessage]);

  return { positions, connected };
}

/**
 * Hook for real-time signal updates
 */
export function useRealtimeSignals() {
  const [signals, setSignals] = useState<Array<{
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT' | 'NEUTRAL';
    strength: number;
    entry_price: number;
    stop_loss: number;
    status: string;
  }>>([]);

  const { onMessage, connected } = useWebSocket({ enabled: true });

  useEffect(() => {
    const unsubscribe = onMessage((data: unknown) => {
      if ((data as { type?: string }).type === 'signals') {
        const signalsData = (data as { data?: { signals?: unknown } }).data;
        if (signalsData?.signals && Array.isArray(signalsData.signals)) {
          setSignals(signalsData.signals as typeof signals);
        }
      }
    });

    return unsubscribe;
  }, [onMessage]);

  return { signals, connected };
}
