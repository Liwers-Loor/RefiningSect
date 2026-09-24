import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('三栏页面启动并在刷新后延续存档时间', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('页面尚未启动。', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '行囊与物品' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '筑器峰宅院' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '剧情' })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('refining-sect.save') || '{}').state?.elapsedMs ?? 0)).toBeGreaterThan(0);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('refining-sect.save') || '{}').state.elapsedMs as number);
  await page.reload();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('refining-sect.save') || '{}').state?.elapsedMs ?? 0)).toBeGreaterThanOrEqual(before);
});

test('侧栏可收起，右侧栏目按按钮切换并在固定区域滚动', async ({ page }) => {
  await page.goto('/');
  const scene = page.getByRole('region', { name: '筑器峰宅院' });
  const initialWidth = await scene.evaluate((element) => element.getBoundingClientRect().width);

  await page.getByRole('button', { name: '收起行囊' }).click();
  await page.getByRole('button', { name: '收起侧栏' }).click();
  await expect(page.getByRole('button', { name: '展开行囊' })).toBeVisible();
  await expect(page.getByRole('button', { name: '展开侧栏' })).toBeVisible();
  expect(await scene.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(initialWidth);

  await page.getByRole('button', { name: '展开侧栏' }).click();
  await page.getByRole('tab', { name: '地点' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('筑器峰宅院');
  await expect(page.getByRole('tabpanel')).not.toContainText('你已获准进入内门');
  expect(await page.getByRole('tabpanel').evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
});

test('直接打开项目文件时给出启动说明', async ({ page }) => {
  await page.goto(`file://${resolve('index.html')}`);
  await expect(page.getByText('不要直接双击 index.html。', { exact: false })).toBeVisible();
});
