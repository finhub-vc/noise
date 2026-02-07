/**
 * Real-time updates hook using WebSocket with HTTP polling fallback
 *
 * Attempts to use WebSocket for real-time updates, falling back to HTTP polling
 * if WebSocket is not available or fails to connect.
 *
 * Polls positions and signals every 3 seconds in fallback mode.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface WebSocketConfig {
  enabled?: boolean;
  reconnectInterval?: number;
  pollingInterval?: number;
  preferPolling?: boolean;
}

export interface WebSocketStatus {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  mode: 'websocket' | 'polling' | 'disconnected';
}

type MessageHandler = (data: unknown) => void;
type ConnectionChangeHandler = (connected: boolean) => void;

export function useWebSocket(config: WebSocketConfig = {}) {
  const {
    enabled = true,
    reconnectInterval = 5000,
    pollingInterval = 3000,
    preferPolling = false,
  } = config;

  const [status, setStatus] = useState<WebSocketStatus>({
    connected: false,
    connecting: false,
    error: null,
    mode: 'disconnected',
  });

  const messageHandlers = useRef(new Set<MessageHandler>());
  const connectionHandlers = useRef(new Set<ConnectionChangeHandler>());
  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update mode in status
  const setStatusWithMode = useCallback((updates: Partial<WebSocketStatus>) => {
    setStatus((prev) => {
      const mode = updates.mode ||
        (updates.connected ? (wsRef.current ? 'websocket' : 'polling') : 'disconnected');
      return { ...prev, ...updates, mode };
    });
  }, []);

  // Connect to real-time updates
  const connect = useCallback(() => {
    if (!enabled) {
      return;
    }

    // Clear any existing reconnection timer
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setStatus({ connected: false, connecting: true, error: null, mode: 'disconnected' });

    // Try WebSocket first unless polling is preferred
    if (!preferPolling) {
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/api/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          // Clear polling when WebSocket connects
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          setStatusWithMode({ connected: true, connecting: false, error: null, mode: 'websocket' });
          notifyConnectionChange(true);
          console.log('[useWebSocket] Connected via WebSocket');
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            notifyHandlers(message);
          } catch (error) {
            console.error('[useWebSocket] Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = (event) => {
          wsRef.current = null;
          setStatusWithMode((prev) => ({
            ...prev,
            connected: false,
            mode: 'disconnected',
          }));
          notifyConnectionChange(false);
          console.log('[useWebSocket] WebSocket closed:', event.code, event.reason);

          // Attempt to reconnect if not explicitly disconnected
          if (enabled && !event.wasClean) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectInterval);
          }
        };

        ws.onerror = (error) => {
          console.error('[useWebSocket] WebSocket error:', error);
          // Fall back to polling on error
          startPolling();
        };

        // Don't start polling yet - wait for WebSocket connection or error
        return;
      } catch (error) {
        console.warn('[useWebSocket] WebSocket creation failed, falling back to polling:', error);
        wsRef.current = null;
      }
    }

    // Fallback to HTTP polling
    startPolling();
  }, [enabled, preferPolling, reconnectInterval, pollingInterval, setStatusWithMode]);

  // Start HTTP polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      return; // Already polling
    }

    console.log('[useWebSocket] Using HTTP polling fallback');
    setStatusWithMode({ connected: false, connecting: false, error: null, mode: 'polling' });

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

        // Mark as connected if we haven't yet
        setStatus((prev) => {
          if (!prev.connected && prev.mode === 'polling') {
            notifyConnectionChange(true);
            return { ...prev, connected: true, mode: 'polling' };
          }
          return prev;
        });
      } catch (error) {
        console.error('[useWebSocket] Polling error:', error);
        setStatus((prev) => ({
          ...prev,
          connected: false,
          error: error as Error,
        }));
        notifyConnectionChange(false);
      }
    }, pollingInterval);

    setStatusWithMode({ connected: true, connecting: false, error: null, mode: 'polling' });
    notifyConnectionChange(true);
  }, [pollingInterval, setStatusWithMode]);

  // Disconnect
  const disconnect = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Clear reconnect timer
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setStatus({ connected: false, connecting: false, error: null, mode: 'disconnected' });
    notifyConnectionChange(false);
  }, [setStatusWithMode]);

  // Send message
  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[useWebSocket] Cannot send message: WebSocket not connected');
    }
  }, []);

  // Subscribe to quotes (WebSocket only)
  const subscribeQuotes = useCallback((symbols: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      send({ type: 'quotes', data: symbols });
    }
  }, [send]);

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
        console.error('[useWebSocket] Handler error:', error);
      }
    });
  }, []);

  const notifyConnectionChange = useCallback((connected: boolean) => {
    connectionHandlers.current.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        console.error('[useWebSocket] Connection change handler error:', error);
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

  // Auto-reconnect on error (only for polling mode)
  useEffect(() => {
    if (status.error && !status.connecting && status.mode === 'polling') {
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, reconnectInterval);

      return () => {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };
    }
  }, [status.error, status.connecting, status.mode, connect, reconnectInterval]);

  return {
    ...status,
    connect,
    disconnect,
    send,
    subscribeQuotes,
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
