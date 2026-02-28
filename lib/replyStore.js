// lib/replyStore.js

export const replyListeners = new Map();

/**
 * Save a message for reply listening
 */
export function registerReply(messageId, data) {
  replyListeners.set(messageId, data);
}

/**
 * Get & optionally delete reply handler
 */
export function getReply(messageId) {
  return replyListeners.get(messageId);
}

export function deleteReply(sessionId, messageId) {
  if (!messageId) return;

  replyListeners.delete(`${sessionId}:${messageId}`);
  replyListeners.delete(`${messageId}`); // ✅ also delete fallback
}
