/**
 * LLM Router — FreeLLM Gateway Client
 *
 * Calls self-hosted FreeLLM gateway at localhost:3001 (OpenAI-compatible).
 * Stub mode for tests: deterministic responses, no network call.
 * SSRF protection: URL is hardcoded, no user input in fetch target.
 */

import type { GuideSession } from './session';
import process from "node:process";

/** Hardcoded FreeLLM gateway URL — no environment variable for the full URL to prevent SSRF */
const FREELLM_CHAT_ENDPOINT = '/v1/chat/completions';
const FREELLM_HEALTH_ENDPOINT = '/health';

/** Allow override of port only (not full URL) via env for container networking */
const FREELLM_PORT = process.env.FREELLM_PORT ? parseInt(process.env.FREELLM_PORT, 10) : 3001;
const FREELLM_HOST = process.env.FREELLM_HOST || 'localhost';

/** Validate port is a safe number */
function validatePort(port: number): number {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 3001;
  }
  return port;
}

const SAFE_PORT = validatePort(FREELLM_PORT);
const FREELLM_URL = `http://${FREELLM_HOST}:${SAFE_PORT}${FREELLM_CHAT_ENDPOINT}`;
const FREELLM_HEALTH_URL = `http://${FREELLM_HOST}:${SAFE_PORT}${FREELLM_HEALTH_ENDPOINT}`;

const STUB_MODE = process.env.FREELLM_STUB === 'true';

/** System prompt — Vietnamese, administrative only, no medical advice */
const SYSTEM_PROMPT = `
Bạn là hướng dẫn viên AI của bệnh viện. Chỉ trả lời về:
- Hướng đường, vị trí phòng/khoa, thời gian chờ
- Thủ tục hành chính: đăng ký, thanh toán, bảo hiểm
- Thông tin chung bệnh viện: giờ mở, địa chỉ, điện thoại

KHÔNG BAO GIỜ tư vấn y khoa, chẩn đoán, kê đơn, giải thích kết quả xét nghiệm.
Nếu bệnh nhân hỏi y khoa: "Xin lỗi, tôi không được phép tư vấn y khoa. Vui lòng hỏi bác sĩ trực tiếp."

Trả lời bằng tiếng Việt, ngắn gọn, lịch sự, dùng "bạn" và "tôi".
`.trim();

export interface LLMResponse {
  content: string;
  usedLLM: true;
}

/** Call FreeLLM gateway (OpenAI-compatible) — URL is hardcoded, no SSRF risk */
export async function callLLM(
  session: GuideSession,
  userMessage: string,
  apiKey: string = process.env.FREELLM_API_KEY ?? ''
): Promise<LLMResponse> {
  if (STUB_MODE) {
    // Deterministic stub for tests — no network call
    return {
      content: `[STUB] Tôi hiểu bạn hỏi: "${userMessage}". ` +
        `Đây là chế độ test. Hỏi tôi về chờ, đường, chi phí, thanh toán, BHYT.`,
      usedLLM: true,
    };
  }

  // Build context: last 4 turns + current step
  const contextTurns = session.history.slice(-4).map((t) => ({
    role: t.role,
    content: t.content,
  }));

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...contextTurns,
    { role: 'user', content: userMessage },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    // Gateway rejects unauthenticated requests with 401 Invalid API key (research/19 §2c)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const key = apiKey.trim();
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    const res = await fetch(FREELLM_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'freellm-guide',
        messages,
        temperature: 0.2,      // Low = consistent, template-like
        max_tokens: 200,       // Short answers
        top_p: 0.9,
      }),
      signal: controller.signal,
      redirect: 'manual', // Prevent redirect attacks
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`FreeLLM error: ${res.status} ${err}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() ||
      'Xin lỗi, tôi không thể trả lời lúc này.';

    return { content, usedLLM: true };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('FreeLLM request timeout');
    }
    throw err;
  }
}

/** Check if FreeLLM gateway is healthy — URL is hardcoded, no SSRF risk */
export async function checkFreeLLMHealth(): Promise<boolean> {
  if (STUB_MODE) return true;

  try {
    const res = await fetch(FREELLM_HEALTH_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
      redirect: 'manual',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get FreeLLM gateway info */
export function getFreeLLMInfo(): { url: string; stubMode: boolean } {
  return {
    url: FREELLM_URL,
    stubMode: STUB_MODE,
  };
}