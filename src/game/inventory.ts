import type { GameState, MaterialId, OwnerId } from './state';

export function quantityAt(state: GameState, ownerId: OwnerId, kind: MaterialId): number {
  return state.stacks.reduce((sum, stack) => sum + (stack.ownerId === ownerId && stack.kind === kind ? stack.quantity : 0), 0);
}

function capacityAt(state: GameState, ownerId: OwnerId, kind: MaterialId): number {
  if (ownerId === 'bag') {
    return state.items.some((item) => item.id === 'bag' && item.ownerId === 'player') ? 100 : 1;
  }
  if (ownerId.startsWith('bucket:')) {
    if (kind === 'wood' || !state.items.some((item) => item.id === ownerId && item.kind === 'bucket' && item.ownerId === 'player')) return 0;
    return 10 - state.stacks.reduce((sum, stack) => sum + (stack.ownerId === ownerId && stack.kind !== kind ? stack.quantity : 0), 0);
  }
  if (ownerId === 'paperArray') return kind === 'earth' && state.paperDeployed ? Number.MAX_SAFE_INTEGER : 0;
  if (ownerId === 'earthStore') return kind === 'earth' ? Number.MAX_SAFE_INTEGER : 0;
  if (ownerId === 'woodStore') return kind === 'wood' ? Number.MAX_SAFE_INTEGER : 0;
  if (ownerId === 'waterStore') return kind === 'water' ? Number.MAX_SAFE_INTEGER : 0;
  return 0;
}

export function addMaterial(state: GameState, ownerId: OwnerId, kind: MaterialId, quantity: number): GameState {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new RangeError('数量必须为正整数');
  if (quantityAt(state, ownerId, kind) + quantity > capacityAt(state, ownerId, kind)) throw new Error('容器容量不足');
  const existing = state.stacks.find((stack) => stack.ownerId === ownerId && stack.kind === kind);
  if (existing) {
    return { ...state, stacks: state.stacks.map((stack) => stack.id === existing.id ? { ...stack, quantity: stack.quantity + quantity } : stack) };
  }
  return {
    ...state,
    stacks: [...state.stacks, { id: state.nextStackId, kind, quantity, ownerId }],
    nextStackId: state.nextStackId + 1
  };
}

export function removeMaterial(state: GameState, ownerId: OwnerId, kind: MaterialId, quantity: number): GameState {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new RangeError('数量必须为正整数');
  if (quantityAt(state, ownerId, kind) < quantity) throw new Error('材料不足');
  let remaining = quantity;
  const stacks = state.stacks.map((stack) => {
    if (stack.ownerId !== ownerId || stack.kind !== kind || remaining === 0) return stack;
    const used = Math.min(stack.quantity, remaining);
    remaining -= used;
    return { ...stack, quantity: stack.quantity - used };
  }).filter((stack) => stack.quantity > 0);
  return { ...state, stacks };
}

export function moveMaterial(state: GameState, source: OwnerId, target: OwnerId, kind: MaterialId, quantity: number): GameState {
  if (source === target) throw new Error('来源和目标不能相同');
  if (quantityAt(state, source, kind) < quantity) throw new Error('材料不足');
  if (quantityAt(state, target, kind) + quantity > capacityAt(state, target, kind)) throw new Error('容器容量不足');
  return addMaterial(removeMaterial(state, source, kind, quantity), target, kind, quantity);
}
