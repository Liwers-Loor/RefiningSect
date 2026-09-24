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

test('玩家通过页面完成采土、转化、砍树、取水和制桶', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '选中' }).click();
  await page.getByRole('button', { name: '设施 · 展开' }).click();
  await page.getByRole('button', { name: '桌子 · 铺开纸质阵图' }).click();
  await page.getByRole('button', { name: '拿起' }).first().click();
  await page.getByRole('button', { name: '泥沼' }).click();
  for (let i = 0; i < 10; i += 1) {
    await page.getByRole('button', { name: '泥潭 · 装土' }).click();
    await page.getByRole('button', { name: '将桶中物资倒入行囊' }).click();
  }
  await expect(page.getByRole('listitem').filter({ hasText: '泥土' })).toContainText('100 / 100');
  await page.getByRole('button', { name: '筑器峰宅院' }).click();
  await page.getByRole('tab', { name: '动作' }).click();
  await page.getByRole('button', { name: '从行囊投入土阵眼' }).click();
  await page.getByRole('button', { name: '催动纸阵 · 10秒耗灵气50' }).click();
  await page.clock.runFor(10000);
  await expect(page.getByText('土阵眼 0 份泥土 · 金阵眼 10 点金气 · 本地游离土气 90')).toBeVisible();
  await page.getByRole('tab', { name: '动作' }).click();
  await page.getByRole('button', { name: '将金气赋予锯子' }).click();
  await page.getByRole('button', { name: '拿起' }).nth(1).click();
  await page.getByRole('button', { name: '丛林' }).click();
  await page.getByRole('button', { name: '椰树林 · 砍伐' }).click();
  await page.getByRole('button', { name: '筑器峰宅院' }).click();
  await page.getByRole('tab', { name: '动作' }).click();
  await page.getByRole('button', { name: '将行囊木头存入柴房' }).click();
  await page.getByRole('button', { name: '灵泉' }).click();
  await page.getByRole('button', { name: '拿起' }).first().click();
  await page.getByRole('button', { name: '泉眼 · 取水' }).click();
  await page.getByRole('button', { name: '将桶中物资倒入行囊' }).click();
  await page.getByRole('tab', { name: '地点' }).click();
  await page.getByRole('button', { name: '筑器峰宅院' }).click();
  await page.getByRole('tab', { name: '动作' }).click();
  await page.getByRole('button', { name: '从柴房取木头5份' }).click();
  await page.getByRole('button', { name: '手工制作木桶 · 木头5份 / 400秒' }).click();
  await page.clock.runFor(400000);
  await page.getByRole('tab', { name: '任务' }).click();
  await expect(page.getByText('已按图纸制成第二只木桶。')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: '下品木桶' })).toHaveCount(2);
});
