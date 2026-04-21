import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import type { PipelineStatus, ScoredMarket } from '../types';

const STATUS_CONFIG: Record<Exclude<PipelineStatus, 'untracked'>, { label: string; bg: string; border: string; text: string; icon: string }> = {
  active:    { label: 'Active',    bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '🔵' },
  watchlist: { label: 'Watchlist', bg: '#fef3c7', border: '#fde68a', text: '#b45309', icon: '👁️' },
  passed:    { label: 'Passed',    bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280', icon: '✕' },
  invested:  { label: 'Invested',  bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', icon: '✓' },
};

const ALL_STATUSES: PipelineStatus[] = ['active', 'watchlist', 'invested', 'passed', 'untracked'];

type TabFilter = PipelineStatus | 'all';

export default function PipelinePage() {
  const markets = useMarketStore(s => s.markets);
  const getScoredMarkets = useMarketStore(s => s.getScoredMarkets);
  const setPipelineStatus = useMarketStore(s => s.setPipelineStatus);
  const _tick = useMarketStore(s => s._lastTick);
  const ranked = useMemo(() => getScoredMarkets(), [markets, _tick]);
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabFilter>('all');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  // Count per status
  const counts = useMemo(() => {
    const c: Record<PipelineStatus, number> = { active: 0, watchlist: 0, passed: 0, invested: 0, untracked: 0 };
    for (const m of ranked) {
      const status = m.market.pipelineStatus || 'untracked';
      c[status]++;
    }
    return c;
  }, [ranked]);

  const filtered = useMemo(() => {
    if (tab === 'all') return ranked.filter(m => (m.market.pipelineStatus || 'untracked') !== 'untracked');
    return ranked.filter(m => (m.market.pipelineStatus || 'untracked') === tab);
  }, [ranked, tab]);

  function saveNotes(marketId: string) {
    const m = ranked.find(x => x.market.id === marketId);
    if (!m) return;
    setPipelineStatus(marketId, m.market.pipelineStatus || 'untracked', notesText);
    setEditingNotes(null);
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investment Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track markets you're actively pursuing, watching, or have decided on.
          </p>
        </div>
      </div>

      {/* Status tabs with counts */}
      <div className="flex gap-2 flex-wrap mb-6">
        <TabPill
          label="All tracked"
          count={counts.active + counts.watchlist + counts.invested + counts.passed}
          active={tab === 'all'}
          onClick={() => setTab('all')}
          colour="#3B1F6B"
          bg="#faf5ff"
        />
        {(['active', 'watchlist', 'invested', 'passed'] as PipelineStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s as Exclude<PipelineStatus, 'untracked'>];
          return (
            <TabPill
              key={s}
              label={`${cfg.icon} ${cfg.label}`}
              count={counts[s]}
              active={tab === s}
              onClick={() => setTab(s)}
              colour={cfg.text}
              bg={cfg.bg}
            />
          );
        })}
        <TabPill
          label="Untracked"
          count={counts.untracked}
          active={tab === 'untracked'}
          onClick={() => setTab('untracked')}
          colour="#6b7280"
          bg="#f9fafb"
        />
      </div>

      {/* Markets list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
          {tab === 'all'
            ? 'No markets tracked yet. Visit Rankings to add markets to your pipeline.'
            : `No markets in ${tab}.`}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <MarketRow
              key={m.market.id}
              sm={m}
              onStatusChange={(status) => setPipelineStatus(m.market.id, status)}
              onEditNotes={() => {
                setEditingNotes(m.market.id);
                setNotesText(m.market.internalNotes || '');
              }}
              isEditingNotes={editingNotes === m.market.id}
              notesText={notesText}
              onNotesChange={setNotesText}
              onSaveNotes={() => saveNotes(m.market.id)}
              onCancelNotes={() => setEditingNotes(null)}
              onOpenDashboard={() => navigate(`/dashboard?market=${m.market.id}`)}
            />
          ))}
        </div>
      )}

      {/* Untracked: quick-add view */}
      {tab === 'untracked' && filtered.length > 0 && (
        <div className="mt-6 text-xs text-gray-500 italic">
          Click a status button on any row to add it to your pipeline.
        </div>
      )}
    </div>
  );
}

function TabPill(props: {
  label: string; count: number; active: boolean; onClick: () => void;
  colour: string; bg: string;
}) {
  return (
    <button
      onClick={props.onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2 ${
        props.active ? 'ring-2 ring-offset-1' : 'hover:shadow-sm'
      }`}
      style={{
        background: props.bg,
        borderColor: props.active ? props.colour : 'transparent',
        color: props.colour,
      }}
    >
      <span>{props.label}</span>
      <span className="px-1.5 py-0.5 rounded-full bg-white/70 text-xs font-bold tabular-nums">{props.count}</span>
    </button>
  );
}

function MarketRow(props: {
  sm: ScoredMarket;
  onStatusChange: (status: PipelineStatus) => void;
  onEditNotes: () => void;
  isEditingNotes: boolean;
  notesText: string;
  onNotesChange: (s: string) => void;
  onSaveNotes: () => void;
  onCancelNotes: () => void;
  onOpenDashboard: () => void;
}) {
  const { sm } = props;
  const status = sm.market.pipelineStatus || 'untracked';
  const cfg = status === 'untracked' ? null : STATUS_CONFIG[status as Exclude<PipelineStatus, 'untracked'>];
  const scoreColor = sm.rag === 'Green' ? '#15803d' : sm.rag === 'Amber' ? '#b45309' : '#b91c1c';

  return (
    <div
      className="bg-white rounded-xl border shadow-sm overflow-hidden"
      style={{ borderColor: cfg?.border || '#e5e7eb' }}
    >
      <div className="flex items-stretch">
        {/* Left status strip */}
        <div
          className="w-1.5"
          style={{ background: cfg?.text || '#e5e7eb' }}
        />

        {/* Main content */}
        <div className="flex-1 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3">
                <h3 className="font-bold text-gray-900 text-lg truncate">{sm.market.name}</h3>
                <span className="text-xs text-gray-400">#{sm.rank}</span>
                <span className="text-xs text-gray-500">{sm.market.region}</span>
              </div>

              {/* Score */}
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold" style={{ color: scoreColor }}>
                    {sm.totalScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400">/ 100</span>
                </div>
                {sm.market.pipelineUpdatedAt && (
                  <span className="text-[11px] text-gray-400">
                    Status updated {new Date(sm.market.pipelineUpdatedAt).toLocaleDateString('en-GB')}
                  </span>
                )}
              </div>

              {/* Notes */}
              {props.isEditingNotes ? (
                <div className="mt-3">
                  <textarea
                    value={props.notesText}
                    onChange={e => props.onNotesChange(e.target.value)}
                    placeholder="Add internal notes — broker conversations, site visits, concerns…"
                    className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={props.onSaveNotes}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: '#3B1F6B' }}
                    >
                      Save notes
                    </button>
                    <button
                      onClick={props.onCancelNotes}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  {sm.market.internalNotes ? (
                    <div className="flex items-start gap-2 text-sm text-gray-600 italic bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-gray-400 flex-shrink-0">📝</span>
                      <span className="flex-1">{sm.market.internalNotes}</span>
                      <button onClick={props.onEditNotes} className="text-xs text-purple-600 hover:text-purple-800">
                        edit
                      </button>
                    </div>
                  ) : (
                    <button onClick={props.onEditNotes} className="text-xs text-gray-400 hover:text-purple-600 italic">
                      + Add notes
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Status + actions */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className="flex gap-1 flex-wrap justify-end">
                {ALL_STATUSES.map(s => {
                  const sCfg = s === 'untracked' ? null : STATUS_CONFIG[s as Exclude<PipelineStatus, 'untracked'>];
                  const active = status === s;
                  const label = s === 'untracked' ? 'Remove' : sCfg!.label;
                  return (
                    <button
                      key={s}
                      onClick={() => props.onStatusChange(s)}
                      disabled={active}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        active ? 'cursor-default' : 'hover:shadow-sm'
                      }`}
                      style={
                        active
                          ? { background: sCfg?.bg || '#f9fafb', borderColor: sCfg?.text || '#6b7280', color: sCfg?.text || '#6b7280' }
                          : { background: 'white', borderColor: '#e5e7eb', color: '#6b7280' }
                      }
                    >
                      {s === 'untracked' && active ? 'Untracked' : label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={props.onOpenDashboard}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                Open in Dashboard →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
