export const COACH_SYSTEM_HARD_MAX = 5_000;
export const COACH_SYSTEM_TARGET = 4_500;
export const COACH_MAX_MESSAGES = 12;
export const COACH_MAX_MESSAGE_CHARS = 4_000;

export type CoachPromptSection = {
  key: string;
  priority: number;
  content: string;
  compact?: string;
  required?: boolean;
};

export type CoachPromptInput = {
  question: string;
  sections: CoachPromptSection[];
};

function clean(value: string): string {
  return value.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function clip(value: string, maxChars: number): string {
  const normalized = clean(value);
  if (normalized.length <= maxChars) return normalized;
  const candidate = normalized.slice(0, Math.max(0, maxChars - 1));
  const boundary = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('; '), candidate.lastIndexOf(' '));
  return `${candidate.slice(0, boundary > maxChars * 0.65 ? boundary + 1 : candidate.length).trim()}…`;
}

function render(sections: CoachPromptSection[]): string {
  return clean(
    sections
      .sort((a, b) => a.priority - b.priority)
      .map(section => `${section.key.toUpperCase()}\n${clean(section.content)}`)
      .join('\n\n'),
  );
}

/**
 * Priority-preserving prompt assembly. It compacts and removes optional,
 * low-priority context before shortening required material. Role, safety, and
 * the athlete's actual question are always retained.
 */
export function buildBudgetedCoachPrompt(input: CoachPromptInput): string {
  const sections: CoachPromptSection[] = [
    ...input.sections.map(section => ({ ...section, content: clean(section.content) })),
    {
      key: 'Athlete question',
      priority: 3,
      required: true,
      content: clip(input.question || 'No question supplied.', 1_000),
    },
  ].filter(section => section.content.length > 0);

  let output = render(sections);
  if (output.length <= COACH_SYSTEM_TARGET) return output;

  for (const section of [...sections].sort((a, b) => b.priority - a.priority)) {
    if (!section.compact || clean(section.compact) === section.content) continue;
    section.content = clean(section.compact);
    output = render(sections);
    if (output.length <= COACH_SYSTEM_TARGET) return output;
  }

  for (const section of [...sections].sort((a, b) => b.priority - a.priority)) {
    if (section.required) continue;
    const index = sections.indexOf(section);
    if (index >= 0) sections.splice(index, 1);
    output = render(sections);
    if (output.length <= COACH_SYSTEM_TARGET) return output;
  }

  for (const section of [...sections].sort((a, b) => b.priority - a.priority)) {
    const minimum = section.key.toLowerCase().includes('safety') ? 700
      : section.key.toLowerCase().includes('question') ? 300
        : section.key.toLowerCase().includes('role') ? 300
          : 180;
    if (section.content.length <= minimum) continue;
    const excess = output.length - COACH_SYSTEM_TARGET;
    section.content = clip(section.content, Math.max(minimum, section.content.length - excess));
    output = render(sections);
    if (output.length <= COACH_SYSTEM_TARGET) return output;
  }

  return enforceCoachSystemPrompt(output);
}

/**
 * Last-line defense for callers that bypass structured assembly. Recognized
 * safety/question blocks are retained before optional blocks are discarded.
 */
export function enforceCoachSystemPrompt(system: string): string {
  const normalized = clean(system);
  if (normalized.length <= COACH_SYSTEM_HARD_MAX) return normalized;

  const blocks = normalized.split(/\n\n+/).filter(Boolean);
  const safety = blocks.filter(block => /safety|never give medical|not diagnose|evidence/i.test(block));
  const question = blocks.filter(block => /athlete question|user question/i.test(block));
  const role = blocks.slice(0, 1);
  const protectedBlocks = [...new Set([...role, ...safety, ...question])];
  const optionalBlocks = blocks.filter(block => !protectedBlocks.includes(block));

  const protectedText = protectedBlocks.join('\n\n');
  const remaining = Math.max(0, COACH_SYSTEM_HARD_MAX - protectedText.length - 2);
  const optionalText = clip(optionalBlocks.join('\n\n'), remaining);
  return clip([protectedText, optionalText].filter(Boolean).join('\n\n'), COACH_SYSTEM_HARD_MAX);
}

export type BudgetableCoachMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function budgetCoachMessages<T extends BudgetableCoachMessage>(messages: T[]): T[] {
  return messages
    .slice(-COACH_MAX_MESSAGES)
    .map(message => ({
      ...message,
      content: clip(message.content, COACH_MAX_MESSAGE_CHARS),
    }));
}

