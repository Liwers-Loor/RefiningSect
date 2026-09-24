import { completeAction } from './production';
import { recordProgress } from './progress';
import type { GameState } from './state';

const PAPER_DURATION_MS = 10000;
const ENERGY_RECOVERY_MS = 60000;

export function advance(state: GameState, deltaMs: number): GameState {
  if (!Number.isSafeInteger(deltaMs) || deltaMs < 0) throw new RangeError('推进时间必须是非负整数毫秒');
  if (state.tutorialPaused || deltaMs === 0) return state;
  if (!Number.isSafeInteger(state.elapsedMs + deltaMs)) throw new RangeError('累计游戏时间超出安全范围');

  let next = state;
  let remaining = deltaMs;
  while (remaining > 0 && !next.tutorialPaused) {
    let step = Math.min(remaining, next.activeAction?.remainingMs ?? remaining);
    if (next.activeAction?.kind === 'paper') {
      step = Math.min(step, ENERGY_RECOVERY_MS - next.energyRecoveryMs);
    }
    const recovered = next.energyRecoveryMs + step;
    const recoveryCount = Math.floor(recovered / ENERGY_RECOVERY_MS);
    next = {
      ...next,
      elapsedMs: next.elapsedMs + step,
      energyRecoveryMs: recovered % ENERGY_RECOVERY_MS,
      auras: next.auras.map((aura) => ({ ...aura, ageMs: aura.ageMs + step }))
    };

    const action = next.activeAction;
    if (action?.kind === 'paper') {
      const remainingMs = action.remainingMs - step;
      const spentEnergy = Math.floor((PAPER_DURATION_MS - remainingMs) / 200);
      next = {
        ...next,
        playerEnergy: Math.min(100, next.playerEnergy - (spentEnergy - action.spentEnergy) + recoveryCount),
        activeAction: remainingMs > 0 ? { ...action, remainingMs, spentEnergy } : null
      };
      if (remainingMs === 0) {
        const completed = completeAction(next, action);
        next = completed.event ? recordProgress(completed.state, completed.event) : completed.state;
      }
    } else if (action?.kind === 'craftBucket') {
      next = { ...next, playerEnergy: Math.min(100, next.playerEnergy + recoveryCount) };
      const remainingMs = action.remainingMs - step;
      if (remainingMs > 0) {
        next = { ...next, activeAction: { ...action, remainingMs } };
      } else {
        const completed = completeAction({ ...next, activeAction: null }, action);
        next = completed.event ? recordProgress(completed.state, completed.event) : completed.state;
      }
    } else {
      next = { ...next, playerEnergy: Math.min(100, next.playerEnergy + recoveryCount) };
    }
    remaining -= step;
  }
  return next;
}
