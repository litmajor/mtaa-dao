import React, { useState } from 'react';
import { Strategy, StrategyInput } from '../../hooks/useStrategyRegistry';

interface InputControlProps {
  input: StrategyInput;
  value: any;
  onChange: (value: any) => void;
}

const InputControl: React.FC<InputControlProps> = ({ input, value, onChange }) => {
  // deterministic id base for accessibility
  const idBase = `strategy-input-${String(input.name).replace(/[^a-z0-9_-]/gi, '-').toLowerCase()}`;
  switch (input.type) {
    case 'number':
      return (
        <div className="space-y-2">
          <label htmlFor={`${idBase}-number`} className="flex justify-between">
            <span className="text-sm font-medium">{input.name}</span>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {value} {input.unit || ''}
            </span>
          </label>
          <div className="space-y-1">
            <input
              id={`${idBase}-range`}
              type="range"
              min={input.min}
              max={input.max}
              value={value}
              onChange={e => onChange(parseFloat(e.target.value))}
              className="w-full"
            />
            <input
              id={`${idBase}-number`}
              type="number"
              value={value}
              onChange={e => onChange(parseFloat(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white"
            />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{input.description}</p>
          {input.min !== undefined && input.max !== undefined && (
            <p className="text-xs text-slate-500">
              Range: {input.min} - {input.max}
            </p>
          )}
        </div>
      );

    case 'string':
      return (
        <div className="space-y-2">
          <label htmlFor={idBase} className="block text-sm font-medium">{input.name}</label>
          <input
            id={idBase}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white"
          />
          <p className="text-xs text-slate-600 dark:text-slate-400">{input.description}</p>
        </div>
      );

    case 'boolean':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              id={idBase}
              type="checkbox"
              checked={value}
              aria-label={input.name}
              onChange={e => onChange(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor={idBase} className="text-sm font-medium">{input.name}</label>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{input.description}</p>
        </div>
      );

    case 'enum':
      return (
        <div className="space-y-2">
          <label htmlFor={idBase} className="block text-sm font-medium">{input.name}</label>
          <select
            id={idBase}
            aria-label={input.name}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white"
          >
            {input.options?.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-600 dark:text-slate-400">{input.description}</p>
        </div>
      );

    case 'array':
      return (
        <div className="space-y-2">
          <label htmlFor={idBase} className="block text-sm font-medium">{input.name}</label>
          <div className="space-y-2">
            {Array.isArray(value) ? (
              value.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    id={`${idBase}-${idx}`}
                    type="text"
                    value={item}
                    onChange={e => {
                      const newArr = [...value];
                      newArr[idx] = e.target.value;
                      onChange(newArr);
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white"
                  />
                  <button
                    onClick={() => onChange(value.filter((_, i) => i !== idx))}
                    className="px-2 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded"
                    aria-label={`Remove ${input.name} item ${idx + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : null}
            <button
              onClick={() => onChange([...(Array.isArray(value) ? value : []), ''])}
              className="w-full px-3 py-2 text-sm border border-dashed border-slate-300 dark:border-slate-600 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              aria-label={`Add ${input.name} item`}
            >
              + Add Item
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{input.description}</p>
        </div>
      );

    default:
      return null;
  }
};

interface StrategyConfiguratorProps {
  strategy: Strategy | null;
  onInputsChange: (inputs: Record<string, any>) => void;
}

export const StrategyConfigurator: React.FC<StrategyConfiguratorProps> = ({
  strategy,
  onInputsChange
}) => {
  const [inputs, setInputs] = useState<Record<string, any>>({});

  // Initialize inputs from strategy
  React.useEffect(() => {
    if (strategy) {
      const initialInputs: Record<string, any> = {};
      strategy.inputs.forEach(input => {
        initialInputs[input.name] = input.value;
      });
      setInputs(initialInputs);
      onInputsChange(initialInputs);
    }
  }, [strategy, onInputsChange]);

  if (!strategy) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-2">⚙️</div>
        <p className="text-slate-600 dark:text-slate-400">
          Select a strategy first to configure inputs
        </p>
      </div>
    );
  }

  const handleInputChange = (inputName: string, value: any) => {
    const updated = { ...inputs, [inputName]: value };
    setInputs(updated);
    onInputsChange(updated);
  };

  const handleReset = () => {
    const defaults: Record<string, any> = {};
    strategy.inputs.forEach(input => {
      defaults[input.name] = input.default;
    });
    setInputs(defaults);
    onInputsChange(defaults);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Configure Strategy Inputs</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Customize parameters for {strategy.name}
        </p>
      </div>

      {/* Strategy Info */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Strategy</div>
            <div className="font-bold text-slate-900 dark:text-white">{strategy.name}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Version</div>
            <div className="font-bold text-slate-900 dark:text-white">v{strategy.version}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Author</div>
            <div className="font-bold text-slate-900 dark:text-white">{strategy.author}</div>
          </div>
          <div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Popularity</div>
            <div className="font-bold text-blue-600">{strategy.popularity}%</div>
          </div>
        </div>
      </div>

      {/* Input Groups */}
      <div className="space-y-6">
        {/* Required Inputs */}
        {strategy.inputs.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {strategy.inputs.map(input => (
                <div key={input.name} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <InputControl
                    input={input}
                    value={inputs[input.name] || input.default}
                    onChange={value => handleInputChange(input.name, value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trading Conditions */}
        {strategy.conditions && strategy.conditions.length > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 border-l-4 border-blue-600 rounded">
            <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
              Trading Conditions
            </h3>
            <div className="space-y-2">
              {strategy.conditions.map((cond, idx) => (
                <div key={idx} className="text-sm text-blue-800 dark:text-blue-200">
                  • {cond.description}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reset Button */}
      <div className="flex gap-2">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};
