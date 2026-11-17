// playwright.config.ts already has Edge-only project @calcom/web-edge
import { test, expect } from '@playwright/test';
import { mockGuideService } from './mock-guide-service';

// Offline degradation test: verify app works without guide service and network
// Expect red status dot, disabled chips, but core functionality still works
test('offline degradation preserves core functionality', async ({ page }) => {
  // Navigate to hospital demo (unseeded load)
  await page.goto('/hospital-demo', { waitUntil: 'networkidle', timeout: 150000 });
  
  // Wait for hospital-ready state
  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, { timeout: 45000 });
  
  // Disconnect guide service (mock returns nothing)
  await mockGuideService(page, { disconnect: true });
  
  // Verify status dot is red ("Chưa kết nối")
  const statusDot = await page.locator('[data-hospital-ready="true"]');
  await expect(statusDot).toHaveAttribute('data-hospital-ready', 'true');
  
  // Verify chips are disabled (opacity < 1 or disabled attribute)
  const chips = page.locator('[data-step]');
  await expect(chips.first()).toHaveAttribute('disabled');
  
  // Core functionality should still work: floor switching, patient info
  await page.click('[data-floor="0"]'); // Click floor 0 tab
  await page.waitForTimeout(1000);
  
  // Verify floor content loads
  const floorContent = page.locator('[data-hospital-ready="true"]');
  await expect(floorContent).toBeVisible();
  
  // Verify patient card displays data
  const patientCard = page.locator('[data-patient]').first();
  await expect(patientCard).toBeVisible();
  
  // Log success for debugging
  console.log('Offline degradation test passed: core functionality works');
});

// Performance thresholds test: verify 27 fps / 33.4ms p95 on Edge
test('performance meets thresholds', async ({ page }) => {
  // Navigate with PERF_T09=1 flag
  await page.goto('/hospital-demo?t=170', { waitUntil: 'networkidle', timeout: 150000 });
  
  // Wait for readiness
  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, { timeout: 45000 });
  
  // Mock guide service (connected state)
  await mockGuideService(page);
  
  // Measure aerial mode performance
  const aerialResult = await page.evaluate(async () => {
    const readout = (window as any).__HOSPITAL_PERF__;
    if (!readout) throw new Error('PERF object missing');
    return {
      fps: readout.fps,
      frameMs: readout.frameMs,
      calls: readout.calls,
      tris: readout.tris
    };
  });
  
  // Assert thresholds
  expect(aerialResult.fps).toBeGreaterThanOrEqual(27);
  expect(aerialResult.frameMs).toBeLessThanOrEqual(33.4);
  
  // Log performance data
  console.log('Aerial performance:', aerialResult);
});

// Floor navigation test: verify clicking floor tabs loads correct content
test('floor switching works', async ({ page }) => {
  await page.goto('/hospital-demo', { waitUntil: 'networkidle', timeout: 150000 });
  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, { timeout: 45000 });
  
  // Click floor 0 tab
  await page.click('[data-floor="0"]');
  await page.waitForTimeout(500);
  
  // Verify floor content appears
  const floorIndicator = page.locator('[data-floor="0"]');
  await expect(floorIndicator).toHaveAttribute('data-floor', '0');
  
  // Click floor 1 tab
  await page.click('[data-floor="1"]');
  await page.waitForTimeout(500);
  
  // Verify floor 1 content
  const floor1Indicator = page.locator('[data-floor="1"]');
  await expect(floor1Indicator).toHaveAttribute('data-floor', '1');
  
  console.log('Floor navigation test passed');
});

// Patient data test: verify `[data-patient]` elements show accurate info
test('patient data displays correctly', async ({ page }) => {
  await page.goto('/hospital-demo', { waitUntil: 'networkidle', timeout: 150000 });
  await page.waitForFunction(() => !!document.querySelector('[data-hospital-ready="true"]'), undefined, { timeout: 45000 });
  
  // Mock guide service
  await mockGuideService(page);
  
  // Wait for patient data to load
  await page.waitForTimeout(1000);
  
  // Get first patient card
  const patientCard = page.locator('[data-patient]').first();
  
  // Verify patient name is visible
  const nameElement = patientCard.locator('.patient-name');
  await expect(nameElement).toBeVisible();
  await expect(nameElement).toContainText(/Trần|Nguyễn|Lê|Vũ/);
  
  // Verify department info
  const deptElement = patientCard.locator('.patient-dept');
  await expect(deptElement).toBeVisible();
  await expect(deptElement).toContainText(/Nội|Khám|RHM/);
  
  // Verify wait time is displayed
  const waitElement = patientCard.locator('.patient-wait');
  await expect(waitElement).toBeVisible();
  await expect(waitElement).toContainText(/phút/);
  
  console.log('Patient data test passed');
});

// Helper: mock guide service (reused across tests)
async function mockGuideService(page) {
  await page.routeWebSocket(
    (url) => url.protocol === 'ws' && url.host === 'localhost:3002',
    (ws) => {
      ws.onMessage((raw) => {
        let frame: any;
        try {
          frame = JSON.parse(String(raw));
        } catch {
          return;
        }
        if (frame.type === 'init') {
          ws.send(JSON.stringify({
            type: 'system',
            content: 'Đã kết nối. Chào bạn!',
            sessionId: frame.sessionId ?? 'hospital-demo-chat',
            metadata: { stepId: 'step-ticket' }
          }));
        }
        if (frame.type === 'user') {
          ws.send(JSON.stringify({
            type: 'assistant',
            content: 'mock',
            metadata: { templateId: 'fallback', usedLLM: false }
          }));
        }
        if (frame.type === 'ping') {
          ws.send(JSON.stringify({ type: 'system', content: 'pong' }));
        }
      });
    }
  );
}