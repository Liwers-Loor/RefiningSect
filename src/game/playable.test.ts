import { describe, expect, it } from 'vitest';
import { advance } from './advance';
import { availableLocations, dispatch } from './actions';
import { quantityAt } from './inventory';
import { arrayGoldQi, auraQuantity, localAura, paperEarthToGold } from './resources';
import { createInitialState } from './state';

describe('首个可玩闭环', () => {
  it('从空仓采土、转化、赋能、储木、取水并手作第二只木桶', () => {
    let state = createInitialState();
    expect(availableLocations(state)).toEqual(['courtyard']);
    state = dispatch(state, { type: 'deployPaper' });
    state = dispatch(state, { type: 'hold', itemId: 'bucket:1' });
    state = dispatch(state, { type: 'travel', locationId: 'marsh' });
    for (let i = 0; i < 10; i += 1) {
      state = dispatch(state, { type: 'collectEarth' });
      state = dispatch(state, { type: 'emptyBucket' });
    }
    expect(quantityAt(state, 'bag', 'earth')).toBe(100);
    state = dispatch(state, { type: 'travel', locationId: 'courtyard' });
    state = dispatch(state, { type: 'placeEarth', quantity: 100 });
    state = dispatch(state, { type: 'startPaper' });
    expect(advance(state, 5000).playerEnergy).toBe(75);
    state = advance(state, 10000);
    expect(state.playerEnergy).toBe(50);
    expect(state.tutorialPaused).toBe(true);
    expect(arrayGoldQi(state)).toBe(10);
    expect(localAura(state, 'earth')).toBe(90);
    expect(advance(state, 30000)).toEqual(state);

    state = dispatch(state, { type: 'enchantSaw' });
    state = dispatch(state, { type: 'hold', itemId: 'saw' });
    state = dispatch(state, { type: 'travel', locationId: 'forest' });
    state = dispatch(state, { type: 'chopWood' });
    expect(quantityAt(state, 'bag', 'wood')).toBe(10);
    expect(state.sawBoostPercent).toBe(950);
    state = dispatch(state, { type: 'travel', locationId: 'courtyard' });
    state = dispatch(state, { type: 'storeWood' });
    expect(availableLocations(state)).toContain('spring');
    state = dispatch(state, { type: 'travel', locationId: 'spring' });
    state = dispatch(state, { type: 'hold', itemId: 'bucket:1' });
    state = dispatch(state, { type: 'collectWater' });
    state = dispatch(state, { type: 'emptyBucket' });
    expect(quantityAt(state, 'bag', 'water')).toBe(10);
    state = dispatch(state, { type: 'travel', locationId: 'courtyard' });
    state = dispatch(state, { type: 'withdrawWood' });
    state = dispatch(state, { type: 'startCraftBucket' });
    expect(quantityAt(state, 'bag', 'wood')).toBe(0);
    state = advance(state, 400000);
    expect(state.items.some((item) => item.id === 'bucket:2')).toBe(true);
    expect(state.milestones.bucketCrafted).toBe(true);
  });

  it('分段与整段推进等价；小批投料没有隐藏余数', () => {
    let state = dispatch(createInitialState(), { type: 'deployPaper' });
    state = dispatch(state, { type: 'hold', itemId: 'bucket:1' });
    state = dispatch(state, { type: 'travel', locationId: 'marsh' });
    state = dispatch(state, { type: 'collectEarth' });
    state = dispatch(state, { type: 'emptyBucket' });
    state = dispatch(state, { type: 'travel', locationId: 'courtyard' });
    state = dispatch(state, { type: 'placeEarth', quantity: 9 });
    state = dispatch(state, { type: 'startPaper' });
    const online = advance(advance(state, 4000), 6000);
    const offline = advance(state, 10000);
    expect(online).toEqual(offline);
    expect(arrayGoldQi(offline)).toBe(0);
    expect(offline.tutorialPaused).toBe(false);
    expect(paperEarthToGold(9)).toEqual({ goldQi: 0, leakedEarthQi: 9 });
    expect(auraQuantity({ id: 1, ownerId: 'courtyard', element: 'earth', initialAmount: 90, ageMs: 35000 })).toBe(45);
    const nearRecovery = { ...state, energyRecoveryMs: 55000 };
    let stepped = nearRecovery;
    for (let i = 0; i < 10; i += 1) stepped = advance(stepped, 1000);
    expect(stepped).toEqual(advance(nearRecovery, 10000));
  });

  it('手作中断损失投入，失败命令不改变原状态', () => {
    let state = dispatch(createInitialState(), { type: 'restart' });
    state = dispatch(state, { type: 'withdrawWood' });
    state = dispatch(state, { type: 'startCraftBucket' });
    expect(() => dispatch(state, { type: 'travel', locationId: 'marsh' })).toThrow('主角正忙');
    state = dispatch(state, { type: 'cancelCraftBucket' });
    expect(state.activeAction).toBeNull();
    expect(quantityAt(state, 'bag', 'wood')).toBe(0);
    expect(quantityAt(state, 'woodStore', 'wood')).toBe(995);
  });

  it('重置开局给真实仓储各一千份且跳过操作暂停', () => {
    let state = dispatch(createInitialState(), { type: 'restart' });
    expect(availableLocations(state)).toEqual(['courtyard', 'marsh', 'forest', 'spring']);
    expect(quantityAt(state, 'earthStore', 'earth')).toBe(1000);
    expect(quantityAt(state, 'woodStore', 'wood')).toBe(1000);
    expect(quantityAt(state, 'waterStore', 'water')).toBe(1000);
    state = dispatch(state, { type: 'deployPaper' });
    state = addEarthToBag(state);
    state = dispatch(state, { type: 'placeEarth', quantity: 100 });
    state = advance(dispatch(state, { type: 'startPaper' }), 10000);
    expect(state.tutorialPaused).toBe(false);
    expect(arrayGoldQi(state)).toBe(10);
  });
});

function addEarthToBag(state: ReturnType<typeof createInitialState>) {
  state = dispatch(state, { type: 'hold', itemId: 'bucket:1' });
  state = dispatch(state, { type: 'travel', locationId: 'marsh' });
  for (let i = 0; i < 10; i += 1) {
    state = dispatch(state, { type: 'collectEarth' });
    state = dispatch(state, { type: 'emptyBucket' });
  }
  return dispatch(state, { type: 'travel', locationId: 'courtyard' });
}
