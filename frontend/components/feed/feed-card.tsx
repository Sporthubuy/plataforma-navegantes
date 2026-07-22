'use client';

import { PostCard } from './post-card';
import { FeedRegattaCard } from './regatta-card';
import { FeedClassifiedCard } from './classified-feed-card';
import { CrewInviteCard } from './crew-invite-card';
import { AchievementCard } from './achievement-card';
import type { FeedItem } from '@/types/feed';

/**
 * Despachador del feed: dado un item, renderiza la tarjeta que
 * corresponde a su tipo. El `switch` es exhaustivo sobre FeedItem, así
 * que agregar un tipo nuevo rompe la compilación hasta contemplarlo.
 */
export function FeedCard({
  item,
  onResolved,
}: {
  item: FeedItem;
  onResolved: (id: string) => void;
}) {
  switch (item.type) {
    case 'post':
      return <PostCard post={item.data} />;
    case 'regatta':
      return <FeedRegattaCard regatta={item.data} />;
    case 'classified':
      return <FeedClassifiedCard classified={item.data} />;
    case 'crew_invite':
      return (
        <CrewInviteCard
          invitation={item.data}
          onResolved={() => onResolved(item.id)}
        />
      );
    case 'achievement':
      return <AchievementCard item={item.data} />;
  }
}
