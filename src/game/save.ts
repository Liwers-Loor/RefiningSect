import { advance } from './advance';
import { createInitialState, isGameState, type GameState } from './state';

export const SAVE_KEY = 'refining-sect.save';

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type LoadResult =
  | { status: 'new' | 'loaded'; state: GameState }
  | { status: 'invalid'; raw: string; reason: string };

const EARLY_V2_KEYS = new Set([
  'schemaVersion', 'elapsedMs', 'locationId', 'items', 'stacks',
  'nextStackId', 'heldItemId', 'paperDeployed', 'playerEnergy'
]);

function migrateState(value: unknown): GameState | null {
  if (isGameState(value)) return value;
  if (typeof value !== 'object' || value === null) return null;
  const previous = value as Record<string, unknown>;
  if (previous.schemaVersion === 2) {
    const keys = Object.keys(previous);
    if (keys.length !== EARLY_V2_KEYS.size || keys.some((key) => !EARLY_V2_KEYS.has(key))) return null;
    const initial = createInitialState();
    // 这份过渡格式没有任务与行动字段；只有未开始操作的存档能安全补齐。
    if (previous.locationId !== 'courtyard' || previous.paperDeployed !== false
      || previous.heldItemId !== null || previous.playerEnergy !== 100
      || previous.nextStackId !== 1 || JSON.stringify(previous.stacks) !== '[]'
      || JSON.stringify(previous.items) !== JSON.stringify(initial.items)) return null;
    const migrated = { ...initial, ...previous };
    return isGameState(migrated) ? migrated : null;
  }
  if (previous.schemaVersion !== 1 || previous.locationId !== 'courtyard'
    || !Number.isSafeInteger(previous.elapsedMs) || (previous.elapsedMs as number) < 0) return null;
  return { ...createInitialState(), elapsedMs: previous.elapsedMs as number };
}

export function loadGame(storage: SaveStorage, nowMs: number): LoadResult {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return { status: 'new', state: createInitialState() };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('存档不是对象');
    }
    const save = parsed as Record<string, unknown>;
    const state = migrateState(save.state);
    if (!state || !Number.isSafeInteger(save.savedAtMs)) {
      throw new Error('结构版本或状态无效');
    }
    const savedAtMs = save.savedAtMs as number;
    if (savedAtMs < 0) throw new Error('保存时间无效');
    return {
      status: 'loaded',
      state: advance(state, Math.max(0, nowMs - savedAtMs))
    };
  } catch (error) {
    return {
      status: 'invalid',
      raw,
      reason: error instanceof Error ? error.message : '无法读取存档'
    };
  }
}

export function saveGame(storage: SaveStorage, state: GameState, nowMs: number): void {
  if (!isGameState(state) || !Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error('拒绝写入无效存档');
  }
  storage.setItem(SAVE_KEY, JSON.stringify({ savedAtMs: nowMs, state }));
}
