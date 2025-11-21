
import React from 'react';

interface CharacterCounterProps {
  current: number;
  max: number;
  min?: number;
}

export function CharacterCounter({ current, max, min }: CharacterCounterProps) {
  const percentage = (current / max) * 100;
  const isOverLimit = current > max;
  const isUnderMin = min !== undefined && current < min;

  return (
    <div className="flex items-center justify-between text-xs mt-1">
      <span className={isUnderMin ? 'text-amber-600' : 'text-gray-500'}>
        {min !== undefined && current < min && `${min - current} more characters needed`}
      </span>
      <span className={isOverLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}>
        {current} / {max}
      </span>
    </div>
  );
}
