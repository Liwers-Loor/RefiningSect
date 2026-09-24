import type { AuraDeposit, GameState } from './state';

export function paperEarthToGold(input: number): { goldQi: number; leakedEarthQi: number } {
  if (!Number.isSafeInteger(input) || input <= 0) throw new RangeError('投料必须为正整数');
  const goldQi = Math.floor(input / 10);
  return { goldQi, leakedEarthQi: input - goldQi };
}

export function auraQuantity(aura: AuraDeposit): number {
  if (aura.ageMs <= 5000) return aura.initialAmount;
  return Math.floor(aura.initialAmount * 2 ** (-(aura.ageMs - 5000) / 30000));
}

export function localAura(state: GameState, element: 'earth' | 'gold'): number {
  return state.auras.reduce((sum, aura) => sum + (aura.ownerId === state.locationId && aura.element === element ? auraQuantity(aura) : 0), 0);
}

export function arrayGoldQi(state: GameState): number {
  return state.auras.reduce((sum, aura) => sum + (aura.ownerId === 'paperArray' && aura.element === 'gold' ? auraQuantity(aura) : 0), 0);
}
