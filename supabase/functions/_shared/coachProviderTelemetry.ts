export const COACH_PROVIDER_MODEL = 'claude-haiku-4-5-20251001';
export const COACH_PROVIDER_MAX_OUTPUT_TOKENS = 1024;

export type CoachTokenUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
};
export type CoachProviderTelemetry = {
  event: 'coach_provider_usage';
  provider: 'anthropic';
  model: string | null;
  usageStatus: 'available' | 'unavailable';
  tokens: CoachTokenUsage | null;
  estimatedCostNanoUsd: number | null;
  costBasis: 'standard_text_token_rates_before_discounts' | null;
  unavailableReason: 'missing_or_invalid_usage' | 'unpriced_model_or_tier' | null;
};

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
// Do not log arbitrary provider strings, even if they resemble model names.
const modelName = (value: unknown): string | null =>
  value === COACH_PROVIDER_MODEL || value === 'claude-haiku-4-5' ? value : null;

/** Parse only billing counters. Missing counters are unknown, never zero spend. */
export function parseCoachTokenUsage(value: unknown): CoachTokenUsage | null {
  const usage = object(value);
  if (!usage || !count(usage.input_tokens) || !count(usage.output_tokens)
    || !count(usage.cache_read_input_tokens) || !count(usage.cache_creation_input_tokens)) return null;
  let cacheWrite5m = 0;
  let cacheWrite1h = 0;
  const cache = object(usage.cache_creation);
  if (usage.cache_creation_input_tokens > 0 || usage.cache_creation != null) {
    if (!cache || !count(cache.ephemeral_5m_input_tokens) || !count(cache.ephemeral_1h_input_tokens)
      || cache.ephemeral_5m_input_tokens + cache.ephemeral_1h_input_tokens !== usage.cache_creation_input_tokens) return null;
    cacheWrite5m = cache.ephemeral_5m_input_tokens;
    cacheWrite1h = cache.ephemeral_1h_input_tokens;
  }
  return { input: usage.input_tokens, output: usage.output_tokens, cacheRead: usage.cache_read_input_tokens,
    cacheWrite5m, cacheWrite1h };
}

/** Integer nanodollars avoid rounding tiny requests to a misleading zero. Not an invoice. */
export function estimateCoachTokenCostNanoUsd(model: string, tokens: CoachTokenUsage): number | null {
  if (model !== COACH_PROVIDER_MODEL && model !== 'claude-haiku-4-5') return null;
  if (![tokens.input, tokens.output, tokens.cacheRead, tokens.cacheWrite5m, tokens.cacheWrite1h].every(count)) return null;
  const value = tokens.input * 1000 + tokens.output * 5000 + tokens.cacheRead * 100
    + tokens.cacheWrite5m * 1250 + tokens.cacheWrite1h * 2000;
  return Number.isSafeInteger(value) ? value : null;
}

/** The returned whitelist cannot include prompts, replies, user IDs, keys or raw errors. */
export function coachProviderTelemetry(result: unknown): CoachProviderTelemetry {
  const response = object(result);
  const usage = object(response?.usage);
  const tokens = parseCoachTokenUsage(usage);
  const model = modelName(response?.model);
  const standardTier = usage?.service_tier == null || usage.service_tier === 'standard';
  // No tools are requested. Unexpected billable tool usage makes the estimate unknown.
  const toolUsage = object(usage?.server_tool_use);
  const textOnly = usage?.server_tool_use == null || (toolUsage !== null
    && Object.values(toolUsage).every(value => count(value) && value === 0));
  const cost = tokens && model && standardTier && textOnly ? estimateCoachTokenCostNanoUsd(model, tokens) : null;
  return { event: 'coach_provider_usage', provider: 'anthropic', model,
    usageStatus: tokens ? 'available' : 'unavailable', tokens,
    estimatedCostNanoUsd: cost, costBasis: cost === null ? null : 'standard_text_token_rates_before_discounts',
    unavailableReason: !tokens ? 'missing_or_invalid_usage' : cost === null ? 'unpriced_model_or_tier' : null };
}
