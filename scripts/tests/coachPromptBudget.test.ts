import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildBudgetedCoachPrompt,
  budgetCoachMessages,
  COACH_SYSTEM_HARD_MAX,
  enforceCoachSystemPrompt,
} from '../../src/utils/coachPromptBudget';

const repeated = (label: string, length: number) => `${label} ${'context '.repeat(length)}`;

test('structured Coach prompts preserve role, safety, and question below the hard limit', () => {
  const prompt = buildBudgetedCoachPrompt({
    question: 'What is mobility?',
    sections: [
      { key: 'Coaching role', priority: 1, required: true, content: repeated('ROLE', 300) },
      { key: 'Safety and evidence rules', priority: 2, required: true, content: repeated('Never diagnose or predict injury.', 300) },
      { key: 'Movement context', priority: 5, required: true, content: repeated('MOVEMENT', 900), compact: 'MOVEMENT compact.' },
      { key: 'Optional recent context', priority: 8, content: repeated('OPTIONAL', 900), compact: 'OPTIONAL compact.' },
    ],
  });
  assert.ok(prompt.length <= COACH_SYSTEM_HARD_MAX);
  assert.match(prompt, /COACHING ROLE/);
  assert.match(prompt, /SAFETY AND EVIDENCE RULES/);
  assert.match(prompt, /What is mobility\?/);
});

test('last-line enforcement hard-limits legacy callers without dropping safety and question', () => {
  const prompt = enforceCoachSystemPrompt([
    'COACHING ROLE\nStrideOS coach.',
    'SAFETY RULES\nNever diagnose or predict injury.',
    repeated('OPTIONAL HISTORY', 1_500),
    'ATHLETE QUESTION\nHow should I train today?',
  ].join('\n\n'));
  assert.ok(prompt.length <= COACH_SYSTEM_HARD_MAX);
  assert.match(prompt, /Never diagnose/);
  assert.match(prompt, /How should I train today\?/);
});

test('message budgeting caps history and individual message size', () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? 'assistant' as const : 'user' as const,
    content: `message ${index} ${'x'.repeat(5_000)}`,
  }));
  const result = budgetCoachMessages(messages);
  assert.equal(result.length, 12);
  assert.ok(result.every(message => message.content.length <= 4_000));
  assert.match(result[0].content, /message 8/);
});
