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
