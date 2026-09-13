import { AiError } from './aiError';

type ContentCallback = (content: string) => void;

function chunkText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .flatMap((part) =>
      part && typeof part === 'object' && 'text' in part && typeof part.text === 'string'
        ? [part.text]
        : [],
    )
    .join('');
}

function contentFromJson(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const choices = 'choices' in value ? value.choices : undefined;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return '';
  const choice = choices[0];
  const delta =
    'delta' in choice && choice.delta && typeof choice.delta === 'object'
      ? choice.delta
      : undefined;
  const message =
    'message' in choice && choice.message && typeof choice.message === 'object'
      ? choice.message
      : undefined;
  return chunkText(
    delta && 'content' in delta
      ? delta.content
      : message && 'content' in message
        ? message.content
        : '',
  );
}

/** Read OpenAI-compatible SSE, while accepting providers that ignore stream and return JSON. */
export async function readChatContent(
  response: Response,
  onContent?: ContentCallback,
): Promise<string> {
  const type = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!response.body || !type.includes('text/event-stream')) {
    const content = contentFromJson(await response.json());
    if (!content) throw new AiError('AI 返回内容为空，请重试');
    onContent?.(content);
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventLines: string[] = [];
  let content = '';
  let finished = false;

  const flushEvent = () => {
    if (!eventLines.length || finished) return;
    const payload = eventLines.join('\n').trim();
    eventLines = [];
    if (!payload) return;
    if (payload === '[DONE]') {
      finished = true;
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new AiError('AI 流式响应格式不正确，请重试');
    }
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      const error = parsed.error;
      const detail =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof error.message === 'string'
          ? error.message
          : 'AI 流式响应出错';
      throw new AiError(detail);
    }
    const delta = contentFromJson(parsed);
    if (!delta) return;
    content += delta;
    onContent?.(content);
  };

  try {
    while (!finished) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? '' : (lines.pop() ?? '');
      for (const line of lines) {
        if (!line.trim()) flushEvent();
        else if (line.startsWith('data:')) eventLines.push(line.slice(5).trimStart());
      }
      if (done) {
        if (buffer) {
          if (buffer.startsWith('data:')) eventLines.push(buffer.slice(5).trimStart());
          buffer = '';
        }
        flushEvent();
        break;
      }
    }
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError('连接中断，已保留已生成内容。', undefined, true);
  }
  if (!content) throw new AiError('AI 返回内容为空，请重试');
  if (!finished) throw new AiError('连接中断，已保留已生成内容。', undefined, true);
  return content;
}

/** Decode only the first JSON reply string so the envelope never flashes in the UI. */
export function extractStreamedReply(raw: string): string {
  const match = /"reply"\s*:\s*"/.exec(raw);
  if (!match) return '';
  let output = '';
  for (let index = match.index + match[0].length; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '"') break;
    if (char !== '\\') {
      output += char;
      continue;
    }
    const escaped = raw[++index];
    if (escaped === undefined) break;
    if (escaped === 'u') {
      const hex = raw.slice(index + 1, index + 5);
      if (!/^[\da-f]{4}$/i.test(hex)) break;
      output += String.fromCharCode(Number.parseInt(hex, 16));
      index += 4;
      continue;
    }
    const replacements: Record<string, string> = {
      '"': '"',
      '\\': '\\',
      '/': '/',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
    };
    if (!(escaped in replacements)) break;
    output += replacements[escaped];
  }
  return output;
}
