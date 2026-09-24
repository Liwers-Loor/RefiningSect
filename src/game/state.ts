export const SAVE_SCHEMA_VERSION = 2;

export type LocationId = 'courtyard' | 'marsh' | 'forest' | 'spring';
export type MaterialId = 'earth' | 'wood' | 'water';
export type ItemKind = 'bag' | 'bucket' | 'shovel' | 'saw' | 'ironBucket' | 'duct' | 'paperArray' | 'table' | 'cushion' | 'bed' | 'cabinet';
export type OwnerId = 'player' | 'courtyard' | 'bag' | 'earthStore' | 'woodStore' | 'waterStore' | `bucket:${number}` | 'paperArray';

export interface Item {
  id: string;
  kind: ItemKind;
  ownerId: 'player' | 'courtyard';
}

export interface MaterialStack {
  id: number;
  kind: MaterialId;
  quantity: number;
  ownerId: OwnerId;
}

export type ActiveAction =
  | { kind: 'paper'; remainingMs: number; spentEnergy: number; inputEarth: number }
  | { kind: 'craftBucket'; remainingMs: number };

export interface Milestones {
  firstTransform: boolean;
  firstEnchantment: boolean;
  woodStored: boolean;
  waterCollected: boolean;
  bucketCrafted: boolean;
}

export interface AuraDeposit {
  id: number;
  ownerId: LocationId | 'paperArray';
  element: 'earth' | 'gold';
  initialAmount: number;
  ageMs: number;
}

export interface GameState {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  elapsedMs: number;
  locationId: LocationId;
  items: Item[];
  stacks: MaterialStack[];
  nextStackId: number;
  heldItemId: string | null;
  paperDeployed: boolean;
  playerEnergy: number;
  energyRecoveryMs: number;
  activeAction: ActiveAction | null;
  auras: AuraDeposit[];
  nextAuraId: number;
  sawBoostPercent: number;
  tutorialPaused: boolean;
  restartMode: boolean;
  milestones: Milestones;
}

export function createInitialState(): GameState {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    elapsedMs: 0,
    locationId: 'courtyard',
    items: [
      { id: 'bag', kind: 'bag', ownerId: 'player' },
      { id: 'bucket:1', kind: 'bucket', ownerId: 'player' },
      { id: 'shovel', kind: 'shovel', ownerId: 'player' },
      { id: 'saw', kind: 'saw', ownerId: 'player' },
      { id: 'ironBucket', kind: 'ironBucket', ownerId: 'player' },
      { id: 'duct', kind: 'duct', ownerId: 'player' },
      { id: 'paperArray', kind: 'paperArray', ownerId: 'player' },
      { id: 'table', kind: 'table', ownerId: 'courtyard' },
      { id: 'cushion', kind: 'cushion', ownerId: 'courtyard' },
      { id: 'bed', kind: 'bed', ownerId: 'courtyard' },
      { id: 'cabinet', kind: 'cabinet', ownerId: 'courtyard' }
    ],
    stacks: [],
    nextStackId: 1,
    heldItemId: null,
    paperDeployed: false,
    playerEnergy: 100,
    energyRecoveryMs: 0,
    activeAction: null,
    auras: [],
    nextAuraId: 1,
    sawBoostPercent: 0,
    tutorialPaused: false,
    restartMode: false,
    milestones: { firstTransform: false, firstEnchantment: false, woodStored: false, waterCollected: false, bucketCrafted: false }
  };
}

export function isGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;
  if (state.schemaVersion !== SAVE_SCHEMA_VERSION || !Number.isSafeInteger(state.elapsedMs) || (state.elapsedMs as number) < 0) return false;
  if (!['courtyard', 'marsh', 'forest', 'spring'].includes(state.locationId as string)) return false;
  if (!Number.isSafeInteger(state.playerEnergy) || (state.playerEnergy as number) < 0 || (state.playerEnergy as number) > 100) return false;
  for (const name of ['energyRecoveryMs', 'sawBoostPercent']) {
    if (!Number.isSafeInteger(state[name]) || (state[name] as number) < 0) return false;
  }
  if ((state.sawBoostPercent as number) > 1000 || (state.energyRecoveryMs as number) >= 60000) return false;
  if (!Array.isArray(state.auras) || !Number.isSafeInteger(state.nextAuraId) || (state.nextAuraId as number) < 1) return false;
  const auraIds = new Set<number>();
  for (const aura of state.auras) {
    if (typeof aura !== 'object' || aura === null || !Number.isSafeInteger(aura.id) || auraIds.has(aura.id)) return false;
    if (!['courtyard', 'marsh', 'forest', 'spring', 'paperArray'].includes(aura.ownerId)) return false;
    if (aura.ownerId === 'paperArray' && !state.paperDeployed) return false;
    if (aura.element !== 'earth' && aura.element !== 'gold') return false;
    if (aura.id < 1 || !Number.isSafeInteger(aura.initialAmount) || aura.initialAmount <= 0 || !Number.isSafeInteger(aura.ageMs) || aura.ageMs < 0 || aura.id >= (state.nextAuraId as number)) return false;
    auraIds.add(aura.id);
  }
  if (typeof state.tutorialPaused !== 'boolean' || typeof state.restartMode !== 'boolean') return false;
  if (typeof state.milestones !== 'object' || state.milestones === null) return false;
  for (const name of ['firstTransform', 'firstEnchantment', 'woodStored', 'waterCollected', 'bucketCrafted']) {
    if (typeof (state.milestones as Record<string, unknown>)[name] !== 'boolean') return false;
  }
  if (state.activeAction !== null) {
    if (typeof state.activeAction !== 'object') return false;
    const action = state.activeAction as Record<string, unknown>;
    if (action.kind !== 'paper' && action.kind !== 'craftBucket') return false;
    if (!Number.isSafeInteger(action.remainingMs) || (action.remainingMs as number) <= 0) return false;
    if (action.kind === 'paper' && (!Number.isSafeInteger(action.spentEnergy) || (action.spentEnergy as number) < 0 || (action.spentEnergy as number) > 50 || !Number.isSafeInteger(action.inputEarth) || (action.inputEarth as number) <= 0 || (action.remainingMs as number) > 10000)) return false;
    if (action.kind === 'craftBucket' && (action.remainingMs as number) > 400000) return false;
  }
  if (!Number.isSafeInteger(state.nextStackId) || (state.nextStackId as number) < 1) return false;
  if (typeof state.paperDeployed !== 'boolean' || !Array.isArray(state.items) || !Array.isArray(state.stacks)) return false;
  if (state.heldItemId !== null && typeof state.heldItemId !== 'string') return false;

  const itemIds = new Set<string>();
  for (const item of state.items) {
    if (typeof item !== 'object' || item === null || typeof item.id !== 'string' || itemIds.has(item.id)) return false;
    if (!['bag', 'bucket', 'shovel', 'saw', 'ironBucket', 'duct', 'paperArray', 'table', 'cushion', 'bed', 'cabinet'].includes(item.kind)) return false;
    if (!['player', 'courtyard'].includes(item.ownerId)) return false;
    itemIds.add(item.id);
  }
  if (state.heldItemId !== null && !state.items.some((item) => item.id === state.heldItemId && item.ownerId === 'player')) return false;
  if (state.paperDeployed !== state.items.some((item) => item.id === 'paperArray' && item.ownerId === 'courtyard')) return false;
  const stackIds = new Set<number>();
  const inventoryTotals = new Map<string, number>();
  for (const stack of state.stacks) {
    if (typeof stack !== 'object' || stack === null || !Number.isSafeInteger(stack.id) || stack.id < 1 || stack.id >= (state.nextStackId as number) || stackIds.has(stack.id)) return false;
    if (!['earth', 'wood', 'water'].includes(stack.kind)) return false;
    if (!Number.isSafeInteger(stack.quantity) || stack.quantity <= 0) return false;
    if (typeof stack.ownerId !== 'string') return false;
    if (stack.ownerId === 'bag') {
      const bagLimit = state.items.some((item) => item.id === 'bag' && item.ownerId === 'player') ? 100 : 1;
      if (stack.quantity > bagLimit) return false;
    } else if (stack.ownerId.startsWith('bucket:')) {
      if (stack.kind === 'wood' || !state.items.some((item) => item.id === stack.ownerId && item.kind === 'bucket' && item.ownerId === 'player')) return false;
    } else if (stack.ownerId === 'paperArray') {
      if (stack.kind !== 'earth' || !state.paperDeployed) return false;
    } else if (stack.ownerId !== `${stack.kind}Store`) return false;
    const key = `${stack.ownerId}:${stack.kind}`;
    if (inventoryTotals.has(key)) return false;
    inventoryTotals.set(key, stack.quantity);
    stackIds.add(stack.id);
  }
  for (const item of state.items) {
    if (item.kind === 'bucket' && (inventoryTotals.get(`${item.id}:earth`) ?? 0) + (inventoryTotals.get(`${item.id}:water`) ?? 0) > 10) return false;
  }
  const activeAction = state.activeAction as ActiveAction | null;
  if (activeAction?.kind === 'paper' && (inventoryTotals.get('paperArray:earth') ?? 0) < activeAction.inputEarth) return false;
  return true;
}
