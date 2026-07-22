import type {
  Invitation,
  Post,
  Regatta,
  RegattaHistoryItem,
} from '@/lib/types';
import type { Classified, CommunityActivity } from '@/lib/types';

/**
 * El feed es multicontenido: cada item declara su tipo y lleva sus
 * datos. `FeedCard` despacha al componente que corresponda.
 */
export type FeedItemType =
  | 'post'
  | 'regatta'
  | 'classified'
  | 'crew_invite'
  | 'achievement'
  | 'activity';

export type FeedItem =
  | { id: string; type: 'post'; data: Post }
  | { id: string; type: 'regatta'; data: Regatta }
  | { id: string; type: 'classified'; data: Classified }
  | { id: string; type: 'crew_invite'; data: Invitation }
  | { id: string; type: 'achievement'; data: RegattaHistoryItem }
  | { id: string; type: 'activity'; data: CommunityActivity };

/**
 * Prioridad al intercalar: lo accionable primero (una invitación
 * pendiente importa más que un post viejo).
 */
export const FEED_PRIORITY: FeedItemType[] = [
  'crew_invite',
  'achievement',
  'activity',
  'regatta',
  'classified',
  'post',
];

/** Máximo de clasificados que entran al feed por tanda. */
export const MAX_CLASSIFIEDS_PER_PAGE = 2;
