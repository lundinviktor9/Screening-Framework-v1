import { useMemo } from 'react';
import { useMarketStore } from '../store/marketStore';
import { METRICS, PILLARS } from '../data/metrics';
import type { MetricSource } from '../types';

/** Unique source key for deduplication */
function sourceKey(s: MetricSource): string {
  return `${s.sourceName}||${s.sourceUrl}||${s.dataDate}`;
}

interface SourceSummary {
  sourceName: string;
  sourceUrl: string;
  dataDate: string;
  status: string;
  metricIds: Set<number>;
  marketCount: number;
}

export default function DataSourcesPage() {
  const markets = useMarketStore(s => s.markets);
  const masterDataDate = useMarketStore(s => s.masterDataDate);

  // Build a summary of all sources across all markets
  const { byPillar, globalStats } = useMemo(() => {
    // Collect sources per metric across all markets
    const metricSources = new Map<number, Map<string, SourceSummary>>();

    for (const market of markets) {
      for (const [idStr, src] of Object.entries(market.sources)) {
        const metricId = Number(idStr);
        if (!src || !src.sourceName) continue;

        if (!metricSources.has(metricId)) {
          metricSources.set(metricId, new Map());
        }
        const key = sourceKey(src);
        const map = metricSources.get(metricId)!;
        if (!map.has(key)) {
          map.set(key, {
            sourceName: src.sourceName,
            sourceUrl: src.sourceUrl || '',
            dataDate: src.dataDate || '',
            status: src.status || 'ESTIMATED',
            metricIds: new Set([metricId]),
            marketCount: 0,
          });
        }
        map.get(key)!.marketCount++;
      }
    }

    // Organize by pillar
    const byPillar: Record<string, {
      metricId: number;
      metricName: string;
      unit: string;
      sources: SourceSummary[];
      marketsWithData: number;
      marketsTotal: number;
    }[]> = {};

    for (const pillar of PILLARS) {
      const pillarMetrics = METRICS.filter(m => m.pillar === pillar.name);
      byPillar[pillar.name] = pillarMetrics.map(metric => {
        const srcMap = metricSources.get(metric.id);
        const sources = srcMap ? Array.from(srcMap.values()) : [];
        // Sort: VERIFIED first, then by market count
        sources.sort((a, b) => {
          if (a.status === 'VERIFIED' && b.status !== 'VERIFIED') return -1;
          if (b.status === 'VERIFIED' && a.status !== 'VERIFIED') return 1;
          return b.marketCount - a.marketCount;
        });

        const marketsWithData = markets.filter(m => {
          const v = m.values[metric.id];
          return v !== null && v !== undefined;
        }).length;

        return {
          metricId: metric.id,
          metricName: metric.name,
          unit: metric.unit,
          sources,
          marketsWithData,
          marketsTotal: markets.length,
        };
      });
    }

    // Global stats
    const totalMetricsWithData = METRICS.filter(metric =>
      markets.some(m => m.values[metric.id] !== null && m.values[metric.id] !== undefined)
    ).length;

    const uniqueSources = new Set<string>();
    for (const market of markets) {
      for (const src of Object.values(market.sources)) {
        if (src?.sourceName) uniqueSources.add(src.sourceName);
      }
    }

    return {
      byPillar,
      globalStats: {
        metricsWithData: totalMetricsWithData,
        totalMetrics: 60,
        uniqueSources: uniqueSources.size,
        totalMarkets: markets.length,
      },
    };
  }, [markets]);

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Data Sources</h1>
        <p className="text-gray-500 text-sm mt-1">
          Audit trail for all metric values — every data point is traceable to its source.
          {masterDataDate && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              Last scraped: {masterDataDate}
            </span>
          )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Metrics with data', value: `${globalStats.metricsWithData}/60`, sub: 'at least 1 market' },
          { label: 'Unique sources', value: String(globalStats.uniqueSources), sub: 'across all markets' },
          { label: 'Markets', value: String(globalStats.totalMarkets), sub: 'in framework' },
          { label: 'Scraper coverage', value: 'M22-25, M33, M35-36, M40, M58', sub: 'automated via API' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-purple-100 shadow-sm px-4 py-3">
            <div className="text-xs text-gray-400 font-medium">{c.label}</div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">{c.value}</div>
            <div className="text-[10px] text-gray-400">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Pillar sections */}
      {PILLARS.map(pillar => {
        const metrics = byPillar[pillar.name] || [];
        const filledCount = metrics.filter(m => m.marketsWithData > 0).length;

        return (
          <div key={pillar.name} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-3 h-3 rounded-full" style={{ background: pillar.colour }} />
              <h2 className="text-base font-bold text-gray-900">{pillar.name}</h2>
              <span className="text-xs text-gray-400">
                {filledCount}/{metrics.length} metrics have data · {pillar.totalWeight} pts weight
              </span>
            </div>

            <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Metric</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Source</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-24">Data date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-20">Status</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 w-24">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map(metric => {
                    const primary = metric.sources[0];
                    const hasData = metric.marketsWithData > 0;
                    const coveragePct = Math.round((metric.marketsWithData / metric.marketsTotal) * 100);

                    return (
                      <tr key={metric.metricId} className={`border-b border-gray-50 ${hasData ? '' : 'opacity-50'}`}>
                        <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                          M{metric.metricId}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800">{metric.metricName}</div>
                          <div className="text-[11px] text-gray-400">{metric.unit}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {primary ? (
                            <div>
                              {primary.sourceUrl ? (
                                <a
                                  href={primary.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-600 hover:text-purple-800 hover:underline font-medium text-xs"
                                >
                                  {primary.sourceName}
                                </a>
                              ) : (
                                <span className="text-xs font-medium text-gray-700">{primary.sourceName}</span>
                              )}
                              {metric.sources.length > 1 && (
                                <span className="text-[10px] text-gray-400 ml-1">
                                  +{metric.sources.length - 1} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No source — manual entry needed</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {primary?.dataDate || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {primary ? (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                              primary.status === 'VERIFIED'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : primary.status === 'REGIONAL_PROXY'
                                ? 'bg-gray-50 text-gray-600 border-gray-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {primary.status === 'VERIFIED' ? 'Verified' :
                               primary.status === 'REGIONAL_PROXY' ? 'Regional' : 'Estimated'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-gray-400">Missing</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`text-xs font-semibold tabular-nums ${
                              coveragePct >= 80 ? 'text-green-600' :
                              coveragePct >= 40 ? 'text-amber-600' :
                              coveragePct > 0 ? 'text-red-600' : 'text-gray-300'
                            }`}>
                              {metric.marketsWithData}/{metric.marketsTotal}
                            </span>
                            <div className="w-10 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${coveragePct}%`,
                                  background: coveragePct >= 80 ? '#15803d' :
                                             coveragePct >= 40 ? '#b45309' :
                                             coveragePct > 0 ? '#dc2626' : '#d1d5db',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <div className="mt-8 text-xs text-gray-400 border-t border-gray-100 pt-4">
        <p className="mb-2 font-semibold text-gray-500">Source hierarchy (highest priority first):</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li><span className="text-green-600 font-semibold">Verified</span> — Government API (NOMIS, ONS, VOA, Environment Agency)</li>
          <li><span className="text-amber-600 font-semibold">Estimated</span> — Manual entry with primary source cited (CoStar, MSCI)</li>
          <li><span className="text-amber-600 font-semibold">Estimated</span> — PDF or HTML scrape with source URL stored</li>
          <li><span className="text-gray-500 font-semibold">Regional proxy</span> — Regional figure cascaded to market level</li>
          <li><span className="text-gray-400 font-semibold">Missing</span> — No data, excluded from scoring</li>
        </ol>
      </div>
    </div>
  );
}
