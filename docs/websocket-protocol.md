# WebSocket Protocol

## Overview

The NOISE trading engine uses WebSockets for real-time bidirectional communication between the dashboard client and API server. The WebSocket endpoint is available at `/api/ws`.

## Connection

### URL
```
ws://localhost/api/ws (development)
wss://your-domain.com/api/ws (production)
```

### Connection Flow
1. Client sends WebSocket upgrade request with `Upgrade: websocket` header
2. Server validates origin (configurable via `setAllowedOrigins()`)
3. Server accepts connection and sends initial data (positions, signals, risk state)
4. Client can subscribe to real-time updates

### Connection Requirements
- Valid `Origin` header (configurable, empty in development)
- Valid session (future: JWT or session cookie)

## Message Format

All messages follow this structure:

```typescript
{
  type: MessageType,
  data?: unknown,
  error?: string,
  timestamp: number
}
```

## Client → Server Messages

### Ping
Heartbeat to keep connection alive.

```json
{
  "type": "ping"
}
```

### Pong
Response to server ping.

```json
{
  "type": "pong"
}
```

### Subscribe to Quotes
Subscribe to real-time quote updates for specific symbols.

```json
{
  "type": "quotes",
  "data": ["AAPL", "MSFT", "TSLA"]
}
```

**Notes:**
- Subscriptions are debounced by 250ms to batch rapid requests
- Symbols are routed to appropriate broker (futures → Tradovate, equities → Alpaca)
- Quote updates are sent every 2 seconds

## Server → Client Messages

### Positions
Current open positions.

```json
{
  "type": "positions",
  "data": [
    {
      "id": "uuid",
      "symbol": "AAPL",
      "side": "LONG",
      "quantity": 100,
      "entry_price": 150.25,
      "current_price": 152.30,
      "unrealized_pnl": 205.00
    }
  ],
  "timestamp": 1704067200000
}
```

### Signals
Active trading signals.

```json
{
  "type": "signals",
  "data": [
    {
      "id": "uuid",
      "symbol": "AAPL",
      "direction": "LONG",
      "strength": 0.85,
      "entry_price": 150.25,
      "stop_loss": 148.00,
      "status": "ACTIVE"
    }
  ],
  "timestamp": 1704067200000
}
```

### Risk
Current risk state.

```json
{
  "type": "risk",
  "data": {
    "id": 1,
    "max_position_size": 10000,
    "max_daily_loss": 1000,
    "current_daily_loss": 250,
    "risk_mode": "NORMAL"
  },
  "timestamp": 1704067200000
}
```

### Quotes
Real-time quote updates for subscribed symbols.

```json
{
  "type": "quotes",
  "data": {
    "AAPL": {
      "last": 150.25,
      "change": 1.50,
      "timestamp": 1704067200000
    },
    "MSFT": {
      "last": 380.50,
      "change": -2.30,
      "timestamp": 1704067200000
    }
  },
  "timestamp": 1704067200000
}
```

### Error
Error notification.

```json
{
  "type": "error",
  "error": "Rate limit exceeded",
  "timestamp": 1704067200000
}
```

## Rate Limiting

- **10 messages per second** per client
- Messages exceeding limit are silently dropped
- Client receives error notification on rate limit exceeded

## Security

### Origin Validation
Configure allowed origins in production:

```typescript
import { setAllowedOrigins } from './websocket/upgradeWebSocket.js';

setAllowedOrigins(['https://dashboard.example.com', '*.example.com']);
```

### Session Validation (TODO)
Future implementation will validate session tokens:

```typescript
// In upgradeWebSocket.ts
async function validateSession(request: Request, env: Env): Promise<boolean> {
  const token = request.headers.get('Authorization');
  // Validate JWT or session cookie
  return true;
}
```

## Error Handling

### Close Codes
- `1000` - Normal closure
- `1009` - Message too large (>1MB)

### Automatic Reconnection
Client automatically reconnects on:
- Unclean disconnect (`!event.wasClean`)
- Network errors

Reconnection interval: 5 seconds (default)

## Fallback Behavior

If WebSocket connection fails, the client automatically falls back to HTTP polling:
- Positions: polled every 3 seconds
- Signals: polled every 3 seconds

## Performance Considerations

### Subscription Debouncing
Rapid subscription changes are batched to prevent excessive API calls:
- Delay: 250ms
- Safety flush: 500ms

### Quote Broadcasting Optimization
- Quotes fetched once per polling interval (2s)
- Client subscriptions tracked in memory
- Only subscribed symbols sent to each client

## Testing

### Example Client (Browser)

```javascript
const ws = new WebSocket('ws://localhost/api/ws');

ws.onopen = () => {
  console.log('Connected');
  // Subscribe to quotes
  ws.send(JSON.stringify({
    type: 'quotes',
    data: ['AAPL', 'MSFT']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message.type, message.data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
};
```

### Example Client (React Hook)

```typescript
import { useWebSocket } from '@/hooks/useWebSocket';

function Component() {
  const { connected, subscribeQuotes, onMessage } = useWebSocket();

  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      if (data.type === 'quotes') {
        console.log('Quote update:', data.data);
      }
    });

    // Subscribe to symbols
    if (connected) {
      subscribeQuotes(['AAPL', 'MSFT']);
    }

    return unsubscribe;
  }, [connected, subscribeQuotes, onMessage]);

  return <div>WebSocket: {connected ? 'Connected' : 'Disconnected'}</div>;
}
```
