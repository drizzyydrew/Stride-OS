import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createSupabaseAvailability,
  getSupabaseClientOrNull,
  resolveSupabaseConfig,
} from '../../lib/supabaseAvailability';

function fakeClient(): SupabaseClient {
  return { auth: {}, storage: {}, from: () => ({}) } as unknown as SupabaseClient;
}

test('reports missing Supabase configuration when both values are absent', () => {
  assert.deepEqual(resolveSupabaseConfig({}), {
    status: 'unavailable',
    reason: 'missing-configuration',
  });
});

test('reports missing Supabase configuration for partial values', () => {
  assert.deepEqual(resolveSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }), {
    status: 'unavailable',
    reason: 'missing-configuration',
  });
  assert.deepEqual(resolveSupabaseConfig({ EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key' }), {
    status: 'unavailable',
    reason: 'missing-configuration',
  });
});

test('reports invalid Supabase URL configuration', () => {
  assert.deepEqual(
    resolveSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'not a url',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    }),
    {
      status: 'unavailable',
      reason: 'invalid-configuration',
    },
  );
});

test('creates an available Supabase state for valid configuration', () => {
  const config = resolveSupabaseConfig({
    EXPO_PUBLIC_SUPABASE_URL: ' https://example.supabase.co ',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: ' anon-key ',
  });
  const availability = createSupabaseAvailability(config, fakeClient);

  assert.equal(availability.status, 'available');
  assert.equal(getSupabaseClientOrNull(availability), availability.status === 'available' ? availability.client : null);
});

test('reports initialization failure without throwing', () => {
  const config = resolveSupabaseConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  });
  const availability = createSupabaseAvailability(config, () => {
    throw new Error('boom');
  });

  assert.deepEqual(availability, {
    status: 'unavailable',
    reason: 'initialization-failed',
  });
});

test('callers can safely branch when Supabase is unavailable', () => {
  const config = resolveSupabaseConfig({});
  const availability = createSupabaseAvailability(config, fakeClient);

  assert.equal(availability.status, 'unavailable');
  assert.equal(getSupabaseClientOrNull(availability), null);
});
