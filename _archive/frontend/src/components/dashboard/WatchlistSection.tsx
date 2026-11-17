import React, { useState } from 'react';
import { Trash2, Bell, Plus, Check, RefreshCw, Layers, X } from 'lucide-react';
import { useWatchlist } from '@/hooks/useWatchlist';
import type {
  WatchlistWithLiveValues,
} from '@/hooks/useWatchlist';
import type {
  WatchlistItemType,
  WatchlistAlertMetric,
  WatchlistAlertDirection,
} from '@/api/yukiApi';

// Which alert metrics make sense per entity type -- must match
// VALID_METRICS_BY_TYPE in server/routes/v1/yuki/watchlist.ts. Kept in
// sync manually since there's no shared schema package between client/server
// in what I've seen of this codebase; if one exists, move this there instead.
const METRICS_BY_TYPE: Record<WatchlistItemType, WatchlistAlertMetric[]> = {
  symbol: ['price'],
  pool: ['apy', 'tvl'],
  vault: ['apy', 'tvl'],
  investment_pool: ['apy', 'tvl'],
  strategy: [],
  creator: [],
};

const ITEM_TYPE_LABELS: Record<WatchlistItemType, string> = {
  symbol: 'Symbol (Trading Asset)',
  pool: 'Liquidity Pool',
  vault: 'Vault',
  investment_pool: 'Investment Pool',
  strategy: 'Strategy',
  creator: 'Creator / Builder',
};

interface WatchlistSectionProps {
  onTradeToken?: (token: string) => void;
}

const WatchlistSection: React.FC<WatchlistSectionProps> = ({ onTradeToken }) => {
  const { watchlists, loading, createWatchlist, deleteWatchlist, addItem, removeItem, updateItemAlert } =
    useWatchlist();

  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [showAddList, setShowAddList] = useState(false);

  const [itemType, setItemType] = useState<WatchlistItemType>('symbol');
  const [targetId, setTargetId] = useState('');
  const [alertMetric, setAlertMetric] = useState<WatchlistAlertMetric | ''>('');
  const [alertDirection, setAlertDirection] = useState<WatchlistAlertDirection>('above');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingAlertItemId, setEditingAlertItemId] = useState<string | null>(null);

  // Default to the first watchlist once loaded, if nothing's selected yet.
  const effectiveListId = selectedListId || watchlists[0]?.id || '';
  const activeWatchlist = watchlists.find((w) => w.id === effectiveListId);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    const newList = await createWatchlist(newListName.trim());
    setSelectedListId(newList.id);
    setNewListName('');
    setShowAddList(false);
  };

  const handleDeleteList = async () => {
    if (!effectiveListId) return;
    if (!confirm('Delete this watchlist and all its items?')) return;
    await deleteWatchlist(effectiveListId);
    setSelectedListId('');
  };

  const handleAddItem = async () => {
    if (!targetId.trim() || !effectiveListId) return;
    try {
      await addItem(effectiveListId, {
        itemType,
        targetId: targetId.trim(),
        ...(alertMetric
          ? {
              alertMetric,
              alertDirection,
              alertThreshold: Number(alertThreshold),
            }
          : {}),
      });
      setTargetId('');
      setAlertMetric('');
      setAlertThreshold('');
      setShowAddItem(false);
    } catch (err: any) {
      // Surfaces the 409 "already on watchlist" / 400 "not a real entity"
      // errors from the router rather than failing silently.
      alert(err?.message || 'Failed to add item');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!effectiveListId) return;
    await removeItem(effectiveListId, itemId);
  };

  const handleSaveAlert = async (itemId: string) => {
    if (!effectiveListId) return;
    if (!alertMetric) {
      await updateItemAlert(effectiveListId, itemId, { alertMetric: null });
    } else {
      await updateItemAlert(effectiveListId, itemId, {
        alertMetric,
        alertDirection,
        alertThreshold: Number(alertThreshold),
      });
    }
    setEditingAlertItemId(null);
    setAlertMetric('');
    setAlertThreshold('');
  };

  const startEditingAlert = (itemId: string, currentMetric: WatchlistAlertMetric | null, currentDirection: WatchlistAlertDirection | null, currentThreshold: number | null) => {
    setEditingAlertItemId(itemId);
    setAlertMetric(currentMetric || '');
    setAlertDirection(currentDirection || 'above');
    setAlertThreshold(currentThreshold?.toString() || '');
  };

  const allowedMetrics = METRICS_BY_TYPE[itemType];

  return (
    <div className="space-y-4 text-slate-800 dark:text-white">
      {/* List Selector / Actions */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Layers className="h-4 w-4 text-slate-400" />
          <select
            value={effectiveListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-3 py-1.5 text-sm"
          >
            {watchlists.length === 0 && <option value="">No watchlists</option>}
            {watchlists.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddList(!showAddList)}
            className="p-2 text-xs border border-slate-300 dark:border-slate-800 rounded hover:bg-slate-100 dark:hover:bg-slate-850"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {effectiveListId && (
          <button
            onClick={handleDeleteList}
            className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete List
          </button>
        )}
      </div>

      {showAddList && (
        <div className="bg-slate-100 dark:bg-slate-850 p-3 rounded border border-slate-200 dark:border-slate-800 flex gap-2">
          <input
            type="text"
            placeholder="List name..."
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 px-2 py-1 rounded text-sm text-slate-900 dark:text-white"
          />
          <button onClick={handleCreateList} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs">
            Create
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-6 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading Watchlist...
        </div>
      ) : activeWatchlist ? (
        <div className="space-y-4">
          {activeWatchlist.items.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Watchlist is empty. Click "+ Add Custom Element" below.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5">Type</th>
                    <th>Element</th>
                    <th className="text-right">Live Value</th>
                    <th className="text-right">Alert</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeWatchlist.items.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 uppercase">
                            {item.item_type}
                          </span>
                        </td>
                        <td className="font-medium text-slate-900 dark:text-slate-100 max-w-[180px] truncate">
                          {item.target_name}
                        </td>
                        <td className="text-right">
                          {item.liveValueSource === 'live' && item.liveValue !== null ? (
                            <span className="font-semibold">${item.liveValue.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-400" title="Live value not available for this item type yet">
                              —
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          {item.alert_active && item.alert_metric ? (
                            <span className="text-amber-500 font-semibold flex items-center gap-1 justify-end">
                              <Bell className="h-3 w-3 shrink-0" />
                              {item.alert_metric} {item.alert_direction} {item.alert_threshold}
                            </span>
                          ) : item.alert_metric && !item.alert_active ? (
                            <span className="text-slate-400 text-[10px]">fired — re-arm to reactivate</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="text-right space-x-1.5">
                          <button
                            onClick={() =>
                              startEditingAlert(item.id, item.alert_metric, item.alert_direction, item.alert_threshold)
                            }
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-amber-500"
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </button>
                          {item.item_type === 'symbol' && onTradeToken && (
                            <button
                              onClick={() => onTradeToken(item.target_name)}
                              className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] uppercase font-semibold"
                            >
                              Trade
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                      {editingAlertItemId === item.id && (
                        <tr className="bg-slate-50 dark:bg-slate-900/70">
                          <td colSpan={5} className="p-3">
                            <div className="flex flex-wrap items-end gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Metric</label>
                                <select
                                  value={alertMetric}
                                  onChange={(e) => setAlertMetric(e.target.value as WatchlistAlertMetric | '')}
                                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-xs"
                                >
                                  <option value="">No alert</option>
                                  {METRICS_BY_TYPE[item.item_type as WatchlistItemType].map((m: WatchlistAlertMetric) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {alertMetric && (
                                <>
                                  <div>
                                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Direction</label>
                                    <select
                                      value={alertDirection}
                                      onChange={(e) => setAlertDirection(e.target.value as WatchlistAlertDirection)}
                                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-xs"
                                    >
                                      <option value="above">Above</option>
                                      <option value="below">Below</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Threshold</label>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      value={alertThreshold}
                                      onChange={(e) => setAlertThreshold(e.target.value)}
                                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-xs w-28"
                                    />
                                  </div>
                                </>
                              )}
                              <button
                                onClick={() => handleSaveAlert(item.id)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1.5"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Save
                              </button>
                              <button
                                onClick={() => setEditingAlertItemId(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-200"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!showAddItem ? (
            <button
              onClick={() => setShowAddItem(true)}
              className="w-full py-2 border border-dashed border-slate-300 dark:border-slate-800 text-slate-400 hover:text-slate-300 rounded text-xs transition-colors"
            >
              + Add Custom Element
            </button>
          ) : (
            <div className="bg-slate-100 dark:bg-slate-850 p-4 rounded border border-slate-200 dark:border-slate-800 space-y-3">
              {/* KNOWN GAP: targetId below is a raw entity UUID, typed by hand.
                  There's no search/autocomplete endpoint for symbols, pools,
                  vaults, etc. wired up here -- I don't have visibility into
                  whether one exists elsewhere in the codebase. Shipping this
                  to real users without a picker means they need to already
                  know the UUID of what they're adding, which isn't realistic
                  outside of testing. Flagging rather than silently shipping
                  a form that only works for developers. */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Type</label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as WatchlistItemType)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-xs"
                  >
                    {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                    Target ID (UUID) — TODO: replace with search
                  </label>
                  <input
                    type="text"
                    placeholder="Entity UUID"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {allowedMetrics.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Alert Metric (optional)</label>
                    <select
                      value={alertMetric}
                      onChange={(e) => setAlertMetric(e.target.value as WatchlistAlertMetric | '')}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-xs"
                    >
                      <option value="">No alert</option>
                      {allowedMetrics.map((m: WatchlistAlertMetric) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  {alertMetric && (
                    <>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Direction</label>
                        <select
                          value={alertDirection}
                          onChange={(e) => setAlertDirection(e.target.value as WatchlistAlertDirection)}
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-xs"
                        >
                          <option value="above">Above</option>
                          <option value="below">Below</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Threshold</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={alertThreshold}
                          onChange={(e) => setAlertThreshold(e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-xs w-28"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddItem(false)}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-800 rounded text-xs text-slate-400 hover:bg-slate-105"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Add to Watchlist
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">Please create a watchlist first.</div>
      )}
    </div>
  );
};

export default WatchlistSection;