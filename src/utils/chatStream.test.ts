import { describe, expect, it } from 'vitest';
import { extractStreamedReply, readChatContent } from './chatStream';

function streamedResponse(parts: Uint8Array[]): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        parts.forEach((part) => controller.enqueue(part));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
  );
}

describe('OpenAI-compatible chat stream', () => {
  it('reads split UTF-8, multiple events, empty deltas and DONE', async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n' +
        'data: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\ndata: [DONE]\n\n',
    );
    const split = bytes.findIndex((value) => value > 127) + 1;
    const updates: string[] = [];
    const content = await readChatContent(
      streamedResponse([
        bytes.slice(0, split),
        bytes.slice(split, split + 2),
        bytes.slice(split + 2),
      ]),
      (value) => updates.push(value),
    );
    expect(content).toBe('你好');
    expect(updates).toEqual(['你', '你好']);
  });

  it('falls back to a regular JSON completion', async () => {
    const response = Response.json({ choices: [{ message: { content: '普通响应' } }] });
    await expect(readChatContent(response)).resolves.toBe('普通响应');
  });

  it('extracts an incomplete escaped reply without exposing the JSON envelope', () => {
    expect(extractStreamedReply('{"reply":"# 标题\\n含有\\"引号\\"、反斜杠 \\\\ 与中文')).toBe(
      '# 标题\n含有"引号"、反斜杠 \\ 与中文',
    );
    expect(extractStreamedReply('{"operations":[]')).toBe('');
    expect(extractStreamedReply('{"reply":"半个 unicode：\\u4e')).toBe('半个 unicode：');
  });

  it('rejects malformed SSE data', async () => {
    await expect(
      readChatContent(streamedResponse([new TextEncoder().encode('data: not-json\n\n')])),
    ).rejects.toThrow('流式响应格式不正确');
  });

  it('marks a stream that ends before DONE as interrupted after preserving content', async () => {
    const updates: string[] = [];
    const promise = readChatContent(
      streamedResponse([
        new TextEncoder().encode('data: {"choices":[{"delta":{"content":"已生成"}}]}\n\n'),
      ]),
      (value) => updates.push(value),
    );
    await expect(promise).rejects.toMatchObject({ interrupted: true });
    expect(updates).toEqual(['已生成']);
  });
});
