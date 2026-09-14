import type { Change } from "../../shared/todo";
export class TodoEvents {
  private listeners = new Set<(change: Change) => void>();
  subscribe(listener: (change: Change) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  publish(change: Change) {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (error) {
        console.error("Todo subscriber failed", error);
      }
    }
  }
}
