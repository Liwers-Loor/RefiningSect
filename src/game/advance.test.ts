import { describe, expect, it } from 'vitest';
import { advance } from './advance';
import { createInitialState } from './state';

describe('确定性时间推进', () => {
  it('分段在线推进与一次离线推进得到同一状态', () => {
    const initial = createInitialState();
    expect(advance(advance(initial, 400), 600)).toEqual(advance(initial, 1000));
    expect(initial.elapsedMs).toBe(0);
  });

  it('拒绝负数和非整数时间', () => {
    expect(() => advance(createInitialState(), -1)).toThrow(RangeError);
    expect(() => advance(createInitialState(), 0.5)).toThrow(RangeError);
  });
});
