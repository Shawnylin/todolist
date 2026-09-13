import { afterEach, describe, expect, it, vi } from 'vitest';
import { chat } from './ai';
import { DEFAULT_SETTINGS, type Settings } from './types';

const settings = (): Settings => ({
  ...DEFAULT_SETTINGS,
  apiKey: 'test-key',
  baseUrl: 'https://example.test/v1',
  model: 'reasoning-model',
});

afterEach(() => vi.unstubAllGlobals());

describe('reasoning request compatibility', () => {
  it.each(['low', 'medium', 'high'] as const)('sends reasoning effort %s', async (effort) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ choices: [{ message: { content: 'ok' } }] }));
    vi.stubGlobal('fetch', fetch);
    await chat(settings(), 'system', 'user', {
      reasoningEnabled: true,
      reasoningEffort: effort,
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body).reasoning_effort).toBe(effort);
  });

  it('omits reasoning when disabled', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ choices: [{ message: { content: 'ok' } }] }));
    vi.stubGlobal('fetch', fetch);
    await chat(settings(), 'system', 'user');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('reasoning_effort');
  });

  it('retries once without reasoning when the provider rejects that parameter', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { error: { message: 'Unsupported parameter: reasoning_effort' } },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'fallback' } }] }));
    vi.stubGlobal('fetch', fetch);
    const fallback = vi.fn();
    await expect(
      chat(settings(), 'system', 'user', {
        reasoningEnabled: true,
        reasoningEffort: 'high',
        onReasoningFallback: fallback,
      }),
    ).resolves.toBe('fallback');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).not.toHaveProperty('reasoning_effort');
    expect(fallback).toHaveBeenCalledOnce();
  });
});
