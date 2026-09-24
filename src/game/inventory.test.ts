import { describe, expect, it } from 'vitest';
import { addMaterial, moveMaterial, quantityAt } from './inventory';
import { createInitialState } from './state';

describe('首段容器与库存', () => {
  it('木桶装满十份后转入行囊，重复十次达到一百份', () => {
    let state = createInitialState();
    for (let turn = 0; turn < 10; turn += 1) {
      state = addMaterial(state, 'bucket:1', 'earth', 10);
      expect(() => addMaterial(state, 'bucket:1', 'earth', 1)).toThrow('容器容量不足');
      state = moveMaterial(state, 'bucket:1', 'bag', 'earth', 10);
    }
    expect(quantityAt(state, 'bag', 'earth')).toBe(100);
    expect(quantityAt(state, 'bucket:1', 'earth')).toBe(0);
    expect(() => addMaterial(state, 'bag', 'earth', 1)).toThrow('容器容量不足');
  });

  it('失败的转移不会改变原库存，也不能让木桶混装木头', () => {
    const initial = addMaterial(createInitialState(), 'bucket:1', 'water', 10);
    expect(() => moveMaterial(initial, 'bucket:1', 'bag', 'water', 11)).toThrow('材料不足');
    expect(() => addMaterial(initial, 'bucket:1', 'wood', 1)).toThrow('容器容量不足');
    expect(quantityAt(initial, 'bucket:1', 'water')).toBe(10);
  });
});
