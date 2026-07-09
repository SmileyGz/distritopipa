export type VIPTier = 'Ninguno' | 'Bronce' | 'Plata' | 'Oro';

export interface VIPStatus {
  tier: VIPTier;
  totalSpent: number;
  nextTier: VIPTier | null;
  amountToNextTier: number | null;
}

export function getVIPStatus(totalSpent: number): VIPStatus {
  if (totalSpent >= 10000) {
    return {
      tier: 'Oro',
      totalSpent,
      nextTier: null,
      amountToNextTier: null,
    };
  }
  if (totalSpent >= 5000) {
    return {
      tier: 'Plata',
      totalSpent,
      nextTier: 'Oro',
      amountToNextTier: 10000 - totalSpent,
    };
  }
  if (totalSpent >= 2500) {
    return {
      tier: 'Bronce',
      totalSpent,
      nextTier: 'Plata',
      amountToNextTier: 5000 - totalSpent,
    };
  }
  return {
    tier: 'Ninguno',
    totalSpent,
    nextTier: 'Bronce',
    amountToNextTier: 2500 - totalSpent,
  };
}

export function getTierColor(tier: VIPTier): string {
  switch (tier) {
    case 'Oro': return '#fbbf24'; // Yellow/Gold
    case 'Plata': return '#9ca3af'; // Gray/Silver
    case 'Bronce': return '#b45309'; // Bronze/Brown
    default: return '#555';
  }
}

export function getTierIcon(tier: VIPTier): string {
  switch (tier) {
    case 'Oro': return '🥇';
    case 'Plata': return '🥈';
    case 'Bronce': return '🥉';
    default: return '👤';
  }
}
