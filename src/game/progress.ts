import type { GameState, Milestones } from './state';

export type ProgressEvent = keyof Milestones;

export function recordProgress(state: GameState, event: ProgressEvent): GameState {
  return { ...state, milestones: { ...state.milestones, [event]: true } };
}
