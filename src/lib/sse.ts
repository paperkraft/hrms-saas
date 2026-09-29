import { EventEmitter } from "events";

// Global singleton to prevent memory leaks in dev
const globalForSse = globalThis as unknown as {
  sseEmitter: EventEmitter | undefined;
};

export const sseEmitter = globalForSse.sseEmitter ?? new EventEmitter();

// Increase max listeners if needed
sseEmitter.setMaxListeners(100);

if (process.env.NODE_ENV !== "production") {
  globalForSse.sseEmitter = sseEmitter;
}
