export class VaultStateTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultStateTransitionError';
  }
}

export class VaultInvariantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultInvariantViolationError';
  }
}
