/** Shared visual vocabulary: stacked tokens for quantity, a token with motion lines for throughput. */
export function TokenMetricIcon({ speed = false }: { speed?: boolean }) {
  return <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="thread-token-metric-icon">
    {speed ? <><path d="M1.5 6h4m-4 4h3m-2 4h3" /><path d="m12 3.5 5.5 3.25v6.5L12 16.5l-5.5-3.25v-6.5Z" /><path d="m13 7.5-2 3h3l-2 3" /></> : <><path d="m10 2.5 7 4-7 4-7-4Z" /><path d="m3 10 7 4 7-4M3 13.5l7 4 7-4" /></>}
  </svg>;
}
