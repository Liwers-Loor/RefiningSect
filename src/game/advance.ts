import type { GameState } from './state';

export function advance(state: GameState, deltaMs: number): GameState {
  if (!Number.isSafeInteger(deltaMs) || deltaMs < 0) {
    throw new RangeError('推进时间必须是非负整数毫秒');
  }
  const elapsedMs = state.elapsedMs + deltaMs;
  if (!Number.isSafeInteger(elapsedMs)) {
    throw new RangeError('累计游戏时间超出安全范围');
  }
  return { ...state, elapsedMs };
}
