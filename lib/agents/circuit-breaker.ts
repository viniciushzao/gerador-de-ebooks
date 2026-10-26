export interface CircuitBreakerConfig {
  maxDepth: number;
  maxLoopsPerTask: number;
  maxTokensPerBook: number;
  maxCostPerBookUsd: number;
  timeoutMsPerTask: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxDepth: 5,
  maxLoopsPerTask: 3,
  maxTokensPerBook: 5_000_000,
  maxCostPerBookUsd: 20.0,
  timeoutMsPerTask: 300_000, // 5 minutes per task
};

export class CircuitBreakerException extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "CircuitBreakerException";
  }
}

export function validateExecutionLimits(
  depth: number,
  loopCount: number,
  currentTokens: number,
  currentCost: number,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
): void {
  if (depth > config.maxDepth) {
    throw new CircuitBreakerException(
      `Limite de profundidade do DAG excedido: ${depth} > ${config.maxDepth}`,
      "MAX_DEPTH_EXCEEDED"
    );
  }

  if (loopCount > config.maxLoopsPerTask) {
    throw new CircuitBreakerException(
      `Limite de tentativas/loops da tarefa excedido: ${loopCount} > ${config.maxLoopsPerTask}`,
      "MAX_LOOPS_EXCEEDED"
    );
  }

  if (currentTokens > config.maxTokensPerBook) {
    throw new CircuitBreakerException(
      `Limite de cota de tokens por livro atingido: ${currentTokens} > ${config.maxTokensPerBook}`,
      "TOKEN_BUDGET_EXCEEDED"
    );
  }

  if (currentCost > config.maxCostPerBookUsd) {
    throw new CircuitBreakerException(
      `Limite de orçamento em dólares atingido: $${currentCost} > $${config.maxCostPerBookUsd}`,
      "COST_BUDGET_EXCEEDED"
    );
  }
}
