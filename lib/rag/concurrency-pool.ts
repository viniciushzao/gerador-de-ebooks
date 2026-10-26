/**
 * Pool de Concorrência assíncrono baseado em semáforo leve.
 * Controla o número máximo de operações paralelas para evitar saturação de CPU/Memory e Rate Limits.
 */
export class ConcurrencyPool {
  private concurrency: number;
  private running: number = 0;
  private queue: Array<() => void> = [];

  constructor(concurrency: number = 5) {
    this.concurrency = Math.max(1, concurrency);
  }

  /**
   * Executa uma tarefa assíncrona respeitando o limite de concorrência.
   */
  public async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }

  /**
   * Mapeia um array de itens executando a função fn em paralelo até o limite do pool.
   */
  public async map<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const promises = items.map((item, index) => this.run(() => fn(item, index)));
    return Promise.all(promises);
  }
}
