/**
 * Utilitário Ultra-Resiliente de Extração e Decodificação de JSON para LLMs
 * 
 * Resolve cenários onde o modelo de linguagem:
 * 1. Anexa comentários ou notas após a chave de fechamento final '}'.
 * 2. Emite texto ou markdown antes do início '{'.
 * 3. Envolve o JSON em blocos ```json ... ``` com texto extra ao redor.
 * 4. Insere caracteres de escape ou trailing commas antes de '}' ou ']'.
 * 5. Emite chaves adicionais no texto pós-JSON que confundem regexes gulosas.
 */

export function extractCleanJsonObject<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Texto de resposta vazio ou inválido para extração de JSON.");
  }

  const trimmed = rawText.trim();

  // 1. Fast-path: parse direto nativo
  try {
    return JSON.parse(trimmed);
  } catch {
    // Prosseguir para extração e reparo
  }

  // 2. Extração de bloco de código Markdown ```json ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const codeBlockContent = codeBlockMatch[1].trim();
    try {
      return JSON.parse(codeBlockContent);
    } catch {
      const repaired = repairJsonString(codeBlockContent);
      try {
        return JSON.parse(repaired);
      } catch {
        // Prossegue para o parser de chaves balanceadas
      }
    }
  }

  // 3. Parser de Chaves Balanceadas (Balanced Brace Matcher)
  // Encontra o primeiro '{' e rastreia a profundidade exata,
  // ignorando chaves dentro de strings literais e respeitando caracteres de escape.
  const startIndex = trimmed.indexOf("{");
  if (startIndex === -1) {
    throw new Error("Nenhum delimitador de início de objeto '{' encontrado na resposta do LLM.");
  }

  let depth = 0;
  let inString = false;
  let escape = false;
  let endIndex = -1;

  for (let i = startIndex; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }
  }

  if (endIndex !== -1) {
    const candidate = trimmed.substring(startIndex, endIndex + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      const repaired = repairJsonString(candidate);
      try {
        return JSON.parse(repaired);
      } catch (err: any) {
        throw new Error(`Falha ao decodificar JSON após balanceamento de chaves: ${err.message}`);
      }
    }
  }

  throw new Error("Estrutura JSON incompleta ou chaves não balanceadas na resposta do LLM.");
}

/**
 * Sanitiza pequenos defeitos comuns gerados por LLMs
 */
export function repairJsonString(jsonStr: string): string {
  return jsonStr
    // Remove trailing commas antes de fechamento de objeto ou array: ", }" ou ", ]"
    .replace(/,\s*([}\]])/g, "$1")
    // Remove caracteres de controle ASCII inválidos (exceto tab e quebras de linha padrão)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}
