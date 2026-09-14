'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function useUtmTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;
    
    const source = searchParams.get('utm_source');
    const medium = searchParams.get('utm_medium');
    const campaign = searchParams.get('utm_campaign');
    const term = searchParams.get('utm_term');
    const content = searchParams.get('utm_content');

    if (source || medium || campaign || term || content) {
      const attribution = {
        utm_source: source,
        utm_medium: medium,
        utm_campaign: campaign,
        utm_term: term,
        utm_content: content,
        timestamp: new Date().toISOString(),
      };

      sessionStorage.setItem('dp_attribution', JSON.stringify(attribution));
    }
  }, [searchParams]);
}
