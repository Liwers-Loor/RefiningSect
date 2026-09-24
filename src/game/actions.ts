import { addMaterial, moveMaterial, quantityAt, removeMaterial } from './inventory';
import { recordProgress } from './progress';
import { arrayGoldQi } from './resources';
import { createInitialState, type GameState, type LocationId } from './state';

export type GameCommand =
  | { type: 'deployPaper' }
  | { type: 'hold'; itemId: string }
  | { type: 'travel'; locationId: LocationId }
  | { type: 'collectEarth' | 'collectWater' | 'chopWood' | 'emptyBucket' | 'storeWood' | 'storeWater' | 'withdrawWood' | 'enchantSaw' | 'startPaper' | 'startCraftBucket' | 'cancelCraftBucket' }
  | { type: 'placeEarth'; quantity: number }
  | { type: 'restart' };

function requireCondition(condition: boolean, reason: string): void {
  if (!condition) throw new Error(reason);
}

function heldBucket(state: GameState): `bucket:${number}` {
  const id = state.heldItemId;
  requireCondition(!!id && state.items.some((item) => item.id === id && item.kind === 'bucket' && item.ownerId === 'player'), '先拿起木桶');
  return id as `bucket:${number}`;
}

function travelAllowed(state: GameState, destination: LocationId): boolean {
  if (destination === 'courtyard') return true;
  if (state.restartMode) return true;
  if (destination === 'marsh') return state.paperDeployed;
  if (destination === 'forest') return state.milestones.firstTransform;
  return state.milestones.woodStored;
}

export function availableLocations(state: GameState): LocationId[] {
  return (['courtyard', 'marsh', 'forest', 'spring'] as const).filter((location) => travelAllowed(state, location));
}

export function dispatch(state: GameState, command: GameCommand): GameState {
  if (command.type === 'restart') {
    let next = { ...createInitialState(), restartMode: true };
    next = addMaterial(next, 'earthStore', 'earth', 1000);
    next = addMaterial(next, 'woodStore', 'wood', 1000);
    return addMaterial(next, 'waterStore', 'water', 1000);
  }
  requireCondition(!state.activeAction || command.type === 'cancelCraftBucket', '主角正忙于当前行动');
  requireCondition(!state.tutorialPaused || command.type === 'enchantSaw' || command.type === 'hold', '先按教学完成锯子赋能');

  switch (command.type) {
    case 'deployPaper': {
      requireCondition(state.locationId === 'courtyard', '纸阵需要在宅院桌上展开');
      requireCondition(state.items.some((item) => item.id === 'table' && item.ownerId === 'courtyard'), '需要一张可用的桌子');
      requireCondition(state.items.some((item) => item.id === 'paperArray' && item.ownerId === 'player'), '没有纸质炼器阵');
      return { ...state, paperDeployed: true, items: state.items.map((item) => item.id === 'paperArray' ? { ...item, ownerId: 'courtyard' } : item) };
    }
    case 'hold': {
      requireCondition(state.items.some((item) => item.id === command.itemId && item.ownerId === 'player'), '物品不在身上');
      return { ...state, heldItemId: command.itemId };
    }
    case 'travel': {
      requireCondition(travelAllowed(state, command.locationId), '此地点尚未发现');
      return { ...state, locationId: command.locationId };
    }
    case 'collectEarth': {
      requireCondition(state.locationId === 'marsh', '只能在泥沼采土');
      const bucket = heldBucket(state);
      requireCondition(quantityAt(state, bucket, 'water') === 0, '木桶里已有水');
      requireCondition(quantityAt(state, bucket, 'earth') < 10, '木桶已满');
      return addMaterial(state, bucket, 'earth', 10 - quantityAt(state, bucket, 'earth'));
    }
    case 'collectWater': {
      requireCondition(state.locationId === 'spring', '只能在灵泉取水');
      const bucket = heldBucket(state);
      requireCondition(quantityAt(state, bucket, 'earth') === 0, '木桶里已有泥土');
      requireCondition(quantityAt(state, bucket, 'water') < 10, '木桶已满');
      return recordProgress(addMaterial(state, bucket, 'water', 10 - quantityAt(state, bucket, 'water')), 'waterCollected');
    }
    case 'emptyBucket': {
      const bucket = heldBucket(state);
      const kind = quantityAt(state, bucket, 'earth') > 0 ? 'earth' : 'water';
      const amount = quantityAt(state, bucket, kind);
      requireCondition(amount > 0, '木桶是空的');
      return moveMaterial(state, bucket, 'bag', kind, amount);
    }
    case 'placeEarth': {
      requireCondition(state.locationId === 'courtyard' && state.paperDeployed, '先在宅院展开纸阵');
      return moveMaterial(state, 'bag', 'paperArray', 'earth', command.quantity);
    }
    case 'startPaper': {
      requireCondition(state.locationId === 'courtyard' && state.paperDeployed, '先在宅院展开纸阵');
      const inputEarth = quantityAt(state, 'paperArray', 'earth');
      requireCondition(inputEarth > 0, '土阵眼还没有泥土');
      requireCondition(state.playerEnergy >= 50, '主角灵气不足50点；可等待自然恢复');
      return { ...state, activeAction: { kind: 'paper', remainingMs: 10000, spentEnergy: 0, inputEarth } };
    }
    case 'enchantSaw': {
      requireCondition(state.items.some((item) => item.id === 'saw' && item.ownerId === 'player'), '锯子不在身上');
      const qi = arrayGoldQi(state);
      requireCondition(qi > 0, '纸阵中没有可用金气');
      requireCondition(qi <= 10, '当前下品锯最多绑定10点金气');
      return recordProgress({
        ...state,
        auras: state.auras.filter((aura) => !(aura.ownerId === 'paperArray' && aura.element === 'gold')),
        sawBoostPercent: qi * 100,
        tutorialPaused: false
      }, 'firstEnchantment');
    }
    case 'chopWood': {
      requireCondition(state.locationId === 'forest', '只能在丛林砍树');
      const boosted = state.heldItemId === 'saw' && state.sawBoostPercent > 0;
      const next = addMaterial(state, 'bag', 'wood', boosted ? 10 : 1);
      return { ...next, sawBoostPercent: boosted ? Math.max(0, next.sawBoostPercent - 50) : next.sawBoostPercent };
    }
    case 'storeWood': {
      requireCondition(state.locationId === 'courtyard', '只能在宅院柴房存木头');
      const amount = quantityAt(state, 'bag', 'wood');
      requireCondition(amount > 0, '行囊里没有木头');
      return recordProgress(moveMaterial(state, 'bag', 'woodStore', 'wood', amount), 'woodStored');
    }
    case 'storeWater': {
      requireCondition(state.locationId === 'courtyard', '只能在宅院水窖存水');
      const amount = quantityAt(state, 'bag', 'water');
      requireCondition(amount > 0, '行囊里没有水');
      return moveMaterial(state, 'bag', 'waterStore', 'water', amount);
    }
    case 'withdrawWood': {
      requireCondition(state.locationId === 'courtyard', '只能在宅院柴房取木头');
      return moveMaterial(state, 'woodStore', 'bag', 'wood', 5);
    }
    case 'startCraftBucket': {
      const next = removeMaterial(state, 'bag', 'wood', 5);
      return { ...next, activeAction: { kind: 'craftBucket', remainingMs: 400000 } };
    }
    case 'cancelCraftBucket': {
      requireCondition(state.activeAction?.kind === 'craftBucket', '当前没有木桶手作');
      return { ...state, activeAction: null };
    }
  }
}
