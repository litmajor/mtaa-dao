import React from 'react';
import { StrategyNode } from '../../models/StrategyNode';
import NodeRegistry from '../../state/node-registry';
import useStrategyGraph from '../../state/strategy-graph.store';

interface Props {
  node: StrategyNode | null;
  issues?: { highest: any; list: any[] } | null;
  focusField?: string | null;
  onClearFocus?: () => void;
}

export default function NodeInspector({ node, issues, focusField, onClearFocus }: Props) {
  const { updateNodeConfig, updateNodeLabel } = useStrategyGraph();
  const [showIssues, setShowIssues] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (focusField) {
      setShowIssues(true);
      // scroll to matching issue if present
      const el = document.querySelector(`[data-issue-field="${focusField}"]`) as HTMLElement | null;
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusField]);

  if (!node) return <div className="p-4 text-slate-400">No node selected</div>;

  const entry = NodeRegistry[node.type];
  const Inspector = entry?.inspector;

  const issueCount = (issues && issues.list && issues.list.length) || 0;

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-slate-300">Node</div>
          <input
            className="w-full mt-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
            value={node.label}
            onChange={(e) => updateNodeLabel(node.id, e.target.value)}
          />
        </div>
        <div className="ml-2 text-right">
          <button
            onClick={() => setShowIssues((s) => !s)}
            className={`px-2 py-1 rounded text-xs font-semibold ${issueCount > 0 ? 'bg-amber-500 text-black' : 'bg-slate-600 text-white'}`}
            title={issueCount > 0 ? `${issueCount} issues` : 'No issues'}
          >
            {issueCount > 0 ? `Issues (${issueCount})` : 'No issues'}
          </button>
        </div>
      </div>

      {showIssues && (
        <div className="mb-3 text-xs">
          {issueCount === 0 ? (
            <div className="text-slate-400">No issues for this node</div>
          ) : (
            <div className="space-y-2">
              {(issues!.list || []).map((it: any, idx: number) => (
                <div
                  key={idx}
                  data-issue-field={it.field || ''}
                  className={`p-2 rounded ${focusField && focusField === it.field ? 'ring-2 ring-amber-400 bg-slate-700' : 'bg-slate-900/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{it.severity}</span>
                      <div className="text-slate-300">{it.message}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          // when clicked, attempt to focus the related inspector field (best-effort)
                          const target = document.querySelector(`[data-field="${it.field}"]`) as HTMLElement | null;
                          if (target && (target as any).focus) (target as any).focus();
                          // notify parent that focus handled
                          if (onClearFocus) onClearFocus();
                        }}
                        className="text-xs underline"
                      >
                        Focus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        {Inspector ? (
          <Inspector
            node={node}
            onChange={(patch: any) => updateNodeConfig(node.id, patch)}
          />
        ) : (
          <pre className="text-xs text-slate-300">No inspector for node type: {node.type}</pre>
        )}
      </div>
    </div>
  );
}
