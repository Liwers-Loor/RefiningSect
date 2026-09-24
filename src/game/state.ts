export const SAVE_SCHEMA_VERSION = 1;

export interface GameState {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  elapsedMs: number;
  locationId: 'courtyard';
}

export function createInitialState(): GameState {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    elapsedMs: 0,
    locationId: 'courtyard'
  };
}

export function isGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;
  return state.schemaVersion === SAVE_SCHEMA_VERSION
    && Number.isSafeInteger(state.elapsedMs)
    && (state.elapsedMs as number) >= 0
    && state.locationId === 'courtyard';
}
