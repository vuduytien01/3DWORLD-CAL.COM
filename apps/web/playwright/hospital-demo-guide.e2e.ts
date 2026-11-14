/**
 * Hospital demo — AI Guide chat HUD (wave 4, T-07b)
 *
 * Data shapes first: the chat speaks the frozen Guide Service protocol from
 * packages/features/hospital-pipeline/lib/ai-guide/server.ts — client frames
 * {type: init|user|ping|health, ...} in, server frames
 * {type: assistant|system|error|health, content, metadata} out. The HUD is a
 * thin display layer (spec 04): one bubble per displayable frame, no client
 * side template routing.
 *
 * The test types a question, sends it, and expects the message list to show
 * the guide's template reply. The Guide Service WebSocket is mocked with
 * page.routeWebSocket so the test stays hermetic: the real service on
 * ws://localhost:3002 is demo infra that must not gate a UI test (QA history:
 * parallel compiles stall the shared dev server).
 *
 * The gate is the HTML5 renderer's readiness attribute — networkidle can pass
 * before the ssr:false renderer paints (ADR 0003). The old dollhouse key-tap
 * test has no equivalent: there is no D key and no __HOSPITAL_DOLLHOUSE__
 * mirror, and the overlay budget pins floors to focus ± 1 by design.
 */

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

test.describe.configure({ retries: 0 });

/** Frame client → Guide Service (frozen, lib/ai-guide/server.ts) */
interface GuideClientFrame {
  type: "init" | "user" | "ping" | "health";
  sessionId?: string;
  content?: string;
}

/**
 * cost-estimate template copy, verbatim from lib/ai-guide/templates.ts — the
 * mocked service answers with the exact frame the real matcher produces for
 * this question, so the test asserts the template contract, not an invented
 * string.
 */
const COST_ESTIMATE_REPLY =
  "Chi phí khám bệnh thường khoảng 100.000–300.000 VNĐ tùy khoa. " +
  "Xét nghiệm, chụp X-quang, siêu âm tính riêng. " +
  "Bảo hiểm y tế giảm 80–100% tùy đối tượng. " +
  "Chi tiết xin hỏi quầy THANH TOÁN khi hoàn tất.";

/** Distinctive prefix of the reply above — stable even if later slots change */
const COST_REPLY_PREFIX = "Chi phí khám bệnh thường khoảng";

/** A question no template chip shares, so text matching stays unambiguous */
const COST_QUESTION = "Chi phí khám bao nhiêu tiền?";

/**
 * Mock the Guide Service at ws://localhost:3002 per the frozen protocol:
 * init → system welcome, user → assistant template frame, ping → pong.
 * The page opens only this one socket (the old scene debug socket is gone);
 * the narrow host match keeps the Next.js HMR socket untouched.
 */
async function mockGuideService(page: Page): Promise<void> {
  await page.routeWebSocket(
    (url) => url.protocol === "ws:" && url.host === "localhost:3002",
    (ws) => {
      ws.onMessage((raw) => {
        let frame: GuideClientFrame;
        try {
          frame = JSON.parse(String(raw)) as GuideClientFrame;
        } catch {
          return;
        }
        if (frame.type === "init") {
          ws.send(
            JSON.stringify({
              type: "system",
              content: "Đã kết nối. Chào bạn!",
              sessionId: frame.sessionId ?? "hospital-demo-chat",
              metadata: { stepId: "step-ticket" },
            })
          );
          return;
        }
        if (frame.type === "user") {
          ws.send(
            JSON.stringify({
              type: "assistant",
              content: COST_ESTIMATE_REPLY,
              metadata: { templateId: "cost-estimate", usedLLM: false },
            })
          );
          return;
        }
        if (frame.type === "ping") {
          ws.send(JSON.stringify({ type: "system", content: "pong" }));
        }
      });
    }
  );
}

/** Open the demo page and wait until the HTML5 renderer claims readiness */
async function gotoHospitalDemo(page: Page): Promise<void> {
  await page.goto("/hospital-demo", { waitUntil: "networkidle" });

  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, {
    timeout: 45000,
  });
}

test.describe("Hospital HTML5 Demo — AI Guide (wave 4)", () => {
  test("gõ câu hỏi → nhận reply template từ guide", async ({ page }) => {
    await mockGuideService(page);
    await gotoHospitalDemo(page);

    // Selector chain: aria-label tiếng Việt → placeholder tiếng Việt
    const chatInput = page
      .getByRole("textbox", { name: "Nhập câu hỏi cho trợ lý AI" })
      .or(page.getByPlaceholder("Nhập câu hỏi..."));

    // System welcome bubble proves the init → ack → display round trip
    await expect(page.getByText("Đã kết nối. Chào bạn!")).toBeVisible({ timeout: 15000 });
    await expect(chatInput).toBeEnabled();

    // fill() sets the value in one shot — no per-character keypresses racing
    // anything else on the page
    await chatInput.fill(COST_QUESTION);
    await page.getByRole("button", { name: "Gửi", exact: true }).click();

    // User bubble echoes the question
    await expect(page.getByText(COST_QUESTION, { exact: true })).toBeVisible();

    // Guide bubble shows the cost-estimate template reply
    await expect(page.getByText(COST_REPLY_PREFIX)).toBeVisible({ timeout: 15000 });
  });
});
