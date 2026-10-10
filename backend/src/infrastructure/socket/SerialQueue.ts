// Keep failed work from poisoning the queue; callers still receive its rejection.
export class SerialQueue {
  private pending = new Map<string, Promise<unknown>>();

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(work);
    this.pending.set(key, next);
    try {
      return await next;
    } finally {
      if (this.pending.get(key) === next) this.pending.delete(key);
    }
  }
}
