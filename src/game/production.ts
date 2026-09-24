import { removeMaterial } from './inventory';
import { paperEarthToGold } from './resources';
import type { ProgressEvent } from './progress';
import type { ActiveAction, GameState } from './state';

export function completeAction(state: GameState, action: ActiveAction): { state: GameState; event: ProgressEvent | null } {
  if (action.kind === 'craftBucket') {
    const nextBucketNumber = state.items.filter((item) => item.kind === 'bucket').length + 1;
    return {
      state: { ...state, items: [...state.items, { id: `bucket:${nextBucketNumber}`, kind: 'bucket', ownerId: 'player' }] },
      event: 'bucketCrafted'
    };
  }

  const result = paperEarthToGold(action.inputEarth);
  const paid = removeMaterial(state, 'paperArray', 'earth', action.inputEarth);
  const deposits = [];
  if (result.goldQi > 0) deposits.push({ id: paid.nextAuraId, ownerId: 'paperArray' as const, element: 'gold' as const, initialAmount: result.goldQi, ageMs: 0 });
  if (result.leakedEarthQi > 0) deposits.push({ id: paid.nextAuraId + deposits.length, ownerId: paid.locationId, element: 'earth' as const, initialAmount: result.leakedEarthQi, ageMs: 0 });
  return {
    state: {
      ...paid,
      auras: [...paid.auras, ...deposits],
      nextAuraId: paid.nextAuraId + deposits.length,
      tutorialPaused: result.goldQi > 0 && !paid.milestones.firstTransform && !paid.restartMode
    },
    event: result.goldQi > 0 ? 'firstTransform' : null
  };
}
