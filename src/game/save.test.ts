import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import { loadGame, saveGame, SAVE_KEY, type SaveStorage } from './save';

function memoryStorage(): SaveStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); }
  };
}

describe('版本化存档', () => {
  it('读取空白存档并通过同一规则补算离线时间', () => {
    const storage = memoryStorage();
    expect(loadGame(storage, 1000)).toEqual({ status: 'new', state: createInitialState() });
    saveGame(storage, createInitialState(), 1000);
    expect(loadGame(storage, 2500)).toEqual({
      status: 'loaded',
      state: { ...createInitialState(), elapsedMs: 1500, energyRecoveryMs: 1500 }
    });
  });

  it('遇到损坏或未知版本时保留原始内容', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{bad');
    expect(loadGame(storage, 1000)).toMatchObject({ status: 'invalid', raw: '{bad' });
    expect(storage.getItem(SAVE_KEY)).toBe('{bad');

    const unknown = JSON.stringify({ savedAtMs: 0, state: { ...createInitialState(), schemaVersion: 3 } });
    storage.setItem(SAVE_KEY, unknown);
    expect(loadGame(storage, 1000)).toMatchObject({ status: 'invalid', raw: unknown });
    expect(storage.getItem(SAVE_KEY)).toBe(unknown);
  });

  it('从基础页面的结构版本 1 迁移，保留已累计的时间', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ savedAtMs: 1000, state: { schemaVersion: 1, elapsedMs: 3000, locationId: 'courtyard' } }));
    const loaded = loadGame(storage, 2000);
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.state.elapsedMs).toBe(4000);
      expect(loaded.state.items.some((item) => item.id === 'bucket:1')).toBe(true);
    }
  });

  it('恢复早期不完整的结构版本 2 存档，保留已有物品、库存和时间', () => {
    const storage = memoryStorage();
    const initial = createInitialState();
    const incomplete = {
      schemaVersion: 2,
      elapsedMs: 499154,
      locationId: 'courtyard',
      items: initial.items,
      stacks: initial.stacks,
      nextStackId: initial.nextStackId,
      heldItemId: initial.heldItemId,
      paperDeployed: initial.paperDeployed,
      playerEnergy: initial.playerEnergy
    };
    storage.setItem(SAVE_KEY, JSON.stringify({ savedAtMs: 1790242123308, state: incomplete }));
    const loaded = loadGame(storage, 1790242124308);
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.state).toMatchObject({ elapsedMs: 500154, items: initial.items, stacks: [], playerEnergy: 100 });
      saveGame(storage, loaded.state, 1790242124308);
      expect(loadGame(storage, 1790242124308)).toEqual(loaded);
    }
  });

  it('不把任意缺字段的结构版本 2 存档误判为早期格式', () => {
    const storage = memoryStorage();
    const { nextAuraId: _missing, ...broken } = createInitialState();
    const raw = JSON.stringify({ savedAtMs: 1000, state: broken });
    storage.setItem(SAVE_KEY, raw);
    expect(loadGame(storage, 2000)).toMatchObject({ status: 'invalid', raw });

    const initial = createInitialState();
    const progressed = JSON.stringify({
      savedAtMs: 1000,
      state: {
        schemaVersion: 2, elapsedMs: 499154, locationId: 'courtyard',
        items: initial.items, stacks: [{ id: 1, kind: 'wood', quantity: 5, ownerId: 'woodStore' }],
        nextStackId: 2, heldItemId: null, paperDeployed: false, playerEnergy: 100
      }
    });
    storage.setItem(SAVE_KEY, progressed);
    expect(loadGame(storage, 2000)).toMatchObject({ status: 'invalid', raw: progressed });
  });

  it('拒绝容量被篡改的存档且保留原文', () => {
    const storage = memoryStorage();
    const corrupt = JSON.stringify({
      savedAtMs: 1000,
      state: { ...createInitialState(), stacks: [{ id: 1, kind: 'earth', quantity: 101, ownerId: 'bag' }], nextStackId: 2 }
    });
    storage.setItem(SAVE_KEY, corrupt);
    expect(loadGame(storage, 2000)).toMatchObject({ status: 'invalid', raw: corrupt });
    expect(storage.getItem(SAVE_KEY)).toBe(corrupt);
  });
});
