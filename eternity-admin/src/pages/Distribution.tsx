import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useDistribution } from '../hooks/useDistribution';
import type { DistributionQueueRow } from '../lib/database.types';

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-LK', { hour: 'numeric', minute: '2-digit' });
}

export default function Distribution() {
  const { profile, user } = useAuth();
  const volunteerName = profile?.full_name || user?.email || 'Committee';
  const { queue, progress, loading, workingItemIds, error, changeDistribution } = useDistribution();
  const { confirm, dialog } = useConfirmDialog();
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? queue.filter((item) => [item.full_name, item.order_code, item.phone].some((value) => value.toLowerCase().includes(term)))
      : queue;
    const groups = new Map<string, DistributionQueueRow[]>();
    matches.forEach((item) => groups.set(item.order_code, [...(groups.get(item.order_code) ?? []), item]));
    return Array.from(groups.entries()).map(([code, items]) => ({
      code,
      items: [...items].sort((a, b) => Number(Boolean(a.distributed_at)) - Number(Boolean(b.distributed_at))),
    }));
  }, [queue, query]);

  const distributed = Number(progress?.distributed ?? 0);
  const total = Number(progress?.total ?? 0);
  const percentage = total > 0 ? Math.min((distributed / total) * 100, 100) : 0;

  const toggleItem = (item: DistributionQueueRow) => {
    if (item.distributed_at) {
      confirm(
        `Undo handover for ${item.product_name} on ${item.order_code}? This reopens the item for distribution.`,
        () => changeDistribution(item, false, volunteerName),
        'Undo handover'
      );
    } else {
      changeDistribution(item, true, volunteerName);
    }
  };

  return (
    <div className="distribution-page">
      <div className="distribution-head">
        <div>
          <p className="eyebrow">Event-day handover</p>
          <h1 className="page-title">Distribution</h1>
        </div>
        <div className="distribution-counter" aria-live="polite">
          <strong>{distributed} / {total}</strong>
          <span>Given out</span>
          <div className="distribution-progress"><span style={{ width: `${percentage}%` }} /></div>
        </div>
      </div>

      <label className="distribution-search">
        <span>Search handover queue</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, order code, or phone" autoComplete="off" />
      </label>

      {error && <p className="distribution-error" role="alert">{error}</p>}
      {loading ? <p className="page-note">Loading distribution queue...</p> : (
        <div className="distribution-groups">
          {filteredGroups.map((group) => (
            <section className="distribution-group" key={group.code}>
              <header>
                <span>{group.code}</span>
                <span>{group.items[0]?.full_name} · {group.items[0]?.phone}</span>
              </header>
              {group.items.map((item) => {
                const given = Boolean(item.distributed_at);
                const working = workingItemIds.includes(item.item_id);
                return (
                  <label className={`distribution-item${given ? ' is-given' : ''}`} key={item.item_id}>
                    <input type="checkbox" checked={given} disabled={working} onChange={() => toggleItem(item)} />
                    <span className="distribution-item-copy">
                      <strong>{item.product_name}{item.size ? ` (${item.size})` : ''}</strong>
                      {given ? <small>Given by {item.distributed_by_name ?? volunteerName}, {formatTime(item.distributed_at!)}</small> : <small>{item.order_code} · {item.full_name}</small>}
                    </span>
                  </label>
                );
              })}
            </section>
          ))}
          {filteredGroups.length === 0 && <p className="page-note">No matching order items.</p>}
        </div>
      )}
      {dialog}
    </div>
  );
}
