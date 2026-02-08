/**
 * WebSocket Module Exports
 */

export {
  WebSocketManager,
  getWebSocketManager,
  type WSMessage,
  type WSClient,
} from './wsHandler.js';

// Re-export for main index.ts
export { upgradeWebSocket, isWebSocketUpgrade } from './upgradeWebSocket.js';
