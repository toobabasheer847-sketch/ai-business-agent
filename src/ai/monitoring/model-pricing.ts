import type { ProviderUsage } from './gemini-usage';

export type ModelPrice = {
  provider: string;
  model: string;
  inputPerMillion: string;
  outputPerMillion: string;
  currency: string;
  source: string;
  effectiveDate: string;
};

export type EstimatedCost = {
  inputCost: string | null;
  outputCost: string | null;
  totalCost: string;
  currency: string;
  source: string;
  effectiveDate: string;
};

const RATE = /^\d+(\.\d{1,8})?$/;

export function parseModelPrices(raw: string | undefined | null): ModelPrice[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const prices: ModelPrice[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const provider = typeof row.provider === 'string' ? row.provider.trim() : '';
    const model = typeof row.model === 'string' ? row.model.trim() : '';
    const inputPerMillion = typeof row.inputPerMillion === 'string' ? row.inputPerMillion.trim() : '';
    const outputPerMillion = typeof row.outputPerMillion === 'string' ? row.outputPerMillion.trim() : '';
    const currency = typeof row.currency === 'string' ? row.currency.trim() : '';
    const source = typeof row.source === 'string' ? row.source.trim() : '';
    const effectiveDate = typeof row.effectiveDate === 'string' ? row.effectiveDate.trim() : '';
    if (!provider || !model || !currency || !source || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) continue;
    if (!RATE.test(inputPerMillion) || !RATE.test(outputPerMillion)) continue;
    prices.push({ provider, model, inputPerMillion, outputPerMillion, currency, source, effectiveDate });
  }
  return prices;
}

export function findModelPrice(prices: ModelPrice[], provider: string, model: string): ModelPrice | undefined {
  return prices.find((price) => price.provider === provider && price.model === model);
}

function tokensTimesRate(tokens: number | null, ratePerMillion: string): string | null {
  if (tokens === null) return null;
  const [whole, fraction = ''] = ratePerMillion.split('.');
  const scale = fraction.length;
  const rate = BigInt(`${whole}${fraction}` || '0');
  const scaled = BigInt(tokens) * rate * (10n ** BigInt(8 - scale));
  const million = 1_000_000n;
  const quotient = scaled / million;
  const remainder = scaled % million;
  const rounded = remainder * 2n >= million ? quotient + 1n : quotient;
  const negative = rounded < 0n;
  const digits = (negative ? -rounded : rounded).toString().padStart(9, '0');
  const head = digits.slice(0, -8) || '0';
  const tail = digits.slice(-8);
  return `${negative ? '-' : ''}${head}.${tail}`;
}

function addDecimal(left: string | null, right: string | null): string | null {
  if (left === null || right === null) return null;
  const toScaled = (value: string) => {
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = value.replace('-', '').split('.');
    return BigInt(`${whole}${fraction.padEnd(8, '0').slice(0, 8)}`) * (negative ? -1n : 1n);
  };
  const sum = toScaled(left) + toScaled(right);
  const negative = sum < 0n;
  const digits = (negative ? -sum : sum).toString().padStart(9, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -8) || '0'}.${digits.slice(-8)}`;
}

export function estimateTokenCost(usage: ProviderUsage, price: ModelPrice | undefined): {
  costStatus: 'estimated' | 'pricing_not_configured' | 'usage_unavailable';
  estimated: EstimatedCost | null;
} {
  if (!usage.available) {
    return { costStatus: 'usage_unavailable', estimated: null };
  }
  if (!price) {
    return { costStatus: 'pricing_not_configured', estimated: null };
  }
  const inputCost = tokensTimesRate(usage.inputTokens, price.inputPerMillion);
  const outputCost = tokensTimesRate(usage.outputTokens, price.outputPerMillion);
  const totalCost = addDecimal(inputCost, outputCost);
  if (!totalCost) {
    return { costStatus: 'pricing_not_configured', estimated: null };
  }
  return {
    costStatus: 'estimated',
    estimated: {
      inputCost,
      outputCost,
      totalCost,
      currency: price.currency,
      source: price.source,
      effectiveDate: price.effectiveDate,
    },
  };
}
