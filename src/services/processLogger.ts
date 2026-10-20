import type { LogServiceType, LogEntry, LogListener } from "./processTypes";

class ProcessLogger {
  private logListeners: Set<LogListener> = new Set();

  public onLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  public emitLog(service: LogServiceType, type: "stdout" | "stderr" | "system", message: string): void {
    const lines = message.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;

    for (const line of lines) {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        service,
        type,
        message: line,
        timestamp: timeStr,
      };

      for (const listener of this.logListeners) {
        try {
          listener(entry);
        } catch (err) {
          console.error("Error in log listener:", err);
        }
      }
    }
  }
}

export const processLogger = new ProcessLogger();
