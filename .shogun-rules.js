/**
 * .shogun-rules.js
 * 
 * Architectural discipline rules for the Background Refactor Agent
 * 
 * Rules enforce "Shogun discipline" - clean separation of concerns,
 * predictable patterns, and consistency across the codebase.
 * 
 * CUSTOMIZE THIS FILE to enforce your project's architectural standards
 */

module.exports = {
  rules: [
    /**
     * API ISOLATION RULES
     * Prevent tight coupling between services
     */
    {
      id: 'api-isolation-services',
      name: 'API Isolation: Independent Services',
      type: 'isolation',
      enabled: true,
      match: /import.*from ['"].*(?:priceHistoryService|ohlcvService|ccxtService)['"]/,
      violation: 'Direct cross-service imports break isolation. Use facade pattern.',
      severity: 'error',
    },
    {
      id: 'api-isolation-ccxt-direct',
      name: 'API Isolation: CCXT Access Control',
      type: 'isolation',
      enabled: true,
      match: (code, filePath) => {
        // Only services should directly use CCXT
        const isCCXT = filePath.includes('ccxtService');
        const importsRaw = code.match(/from ['"].*\bcCXXt\b['"]/g) || [];
        return !isCCXT && importsRaw.length > 0;
      },
      violation: 'CCXT should only be accessed through ccxtService',
      severity: 'warning',
    },

    /**
     * POLLING CONSTRAINTS
     * Prevent API rate limiting and cost explosion
     */
    {
      id: 'polling-minimum-interval',
      name: 'Polling: Minimum 1000ms Interval',
      type: 'frequency',
      enabled: true,
      match: /setInterval\s*\([^)]*,\s*(?:[0-9]{1,3}(?!\d)|[0-9]{1,2}0(?!\d))\s*\)/,
      violation: 'Polling intervals < 1000ms cause rate limiting. Use >= 1000ms.',
      severity: 'warning',
    },
    {
      id: 'polling-exchange-rate',
      name: 'Polling: Exchange API Rate Limit',
      type: 'frequency',
      enabled: true,
      match: /(?:fetchTicker|fetchOHLCV|fetchOrderBook).*setInterval/,
      violation: 'Exchange API calls should respect rate limits (typically 5-10 req/min)',
      severity: 'error',
    },

    /**
     * NAMING STANDARDS
     * Enforce consistent naming conventions
     */
    {
      id: 'naming-constants-upper',
      name: 'Naming: Constants in UPPER_CASE',
      type: 'naming',
      enabled: true,
      match: /const\s+[a-z][a-zA-Z0-9_]*\s*=\s*(?:process\.env|require\(['"][^'"]*config)/,
      violation: 'Configuration constants must use UPPER_CASE (e.g., API_KEY not apiKey)',
      severity: 'warning',
    },
    {
      id: 'naming-functions-camel',
      name: 'Naming: Functions in camelCase',
      type: 'naming',
      enabled: true,
      match: /^(function|async function)\s+[A-Z]/m,
      violation: 'Function names should be camelCase, not PascalCase (e.g., getFoo not GetFoo)',
      severity: 'warning',
    },
    {
      id: 'naming-classes-pascal',
      name: 'Naming: Classes in PascalCase',
      type: 'naming',
      enabled: true,
      match: /^(class|interface)\s+[a-z]/m,
      violation: 'Class names should be PascalCase (e.g., MyClass not myClass)',
      severity: 'warning',
    },

    /**
     * SECURITY RULES
     * Prevent dangerous patterns
     */
    {
      id: 'security-no-eval',
      name: 'Security: No eval()',
      type: 'custom',
      enabled: true,
      match: /\beval\s*\(/,
      violation: 'eval() is forbidden for security reasons',
      severity: 'error',
    },
    {
      id: 'security-no-require-dynamic',
      name: 'Security: No Dynamic require()',
      type: 'custom',
      enabled: true,
      match: /require\s*\(\s*variables|require\s*\(\s*\[/,
      violation: 'Dynamic requires (with variables) are not allowed for security',
      severity: 'error',
    },

    /**
     * TYPE SAFETY RULES
     * Encourage proper TypeScript usage
     */
    {
      id: 'type-safety-no-any',
      name: 'Type Safety: No "any" Type',
      type: 'custom',
      enabled: true,
      match: /:\s*any\b(?![\s]*\/\/\s*intentional|[\s]*\/\/\s*unavoidable)/,
      violation:
        'Avoid "any" type for type safety. Use specific types or "unknown" if needed.',
      severity: 'warning',
    },
    {
      id: 'type-safety-no-implicit-any',
      name: 'Type Safety: No Implicit Any',
      type: 'custom',
      enabled: true,
      match: /=>\s*\{|function\s+\w+\s*\(/,
      violation: 'Function parameters should have type annotations',
      severity: 'warning',
    },

    /**
     * DEPENDENCY RULES
     * Enforce clean dependency graph
     */
    {
      id: 'dependency-no-circular',
      name: 'Dependency: No Circular Dependencies',
      type: 'dependency',
      enabled: true,
      match: (code, filePath) => {
        // This is a marker; actual circular detection happens in ImportValidator
        return false;
      },
      violation: 'Circular dependencies detected. Refactor to break the cycle.',
      severity: 'error',
    },
    {
      id: 'dependency-external-isolation',
      name: 'Dependency: External API Isolation',
      type: 'dependency',
      enabled: true,
      match: /(fetch|axios|https?\.get)\s*\(/,
      violation:
        'Direct HTTP calls should go through service layer (ccxtService, priceHistoryService)',
      severity: 'warning',
    },

    /**
     * ASYNC/AWAIT RULES
     * Prevent common async pitfalls
     */
    {
      id: 'async-error-handling',
      name: 'Async: Promise Error Handling',
      type: 'custom',
      enabled: false, // Disabled by default (complex pattern matching)
      match: /\\.catch\s*\(\s*\)/,
      violation: 'Empty catch blocks hide errors and make debugging difficult',
      severity: 'error',
    },
    {
      id: 'async-no-dangling-promises',
      name: 'Async: No Dangling Promises',
      type: 'custom',
      enabled: false,
      match: /(?<!await\s)\w+\s*\(\).*Promise/,
      violation: 'Use "await" or ".catch()" for all promises to avoid unhandled rejections',
      severity: 'warning',
    },

    /**
     * CUSTOM RULES - Easy to add more
     */
    {
      id: 'custom-no-console-log',
      name: 'Custom: Use Logger Instead of console',
      type: 'custom',
      enabled: true,
      match: /console\.(log|error|warn|info|debug)/,
      violation:
        'Use logger.info/warn/error instead of console.* for consistent logging',
      severity: 'warning',
    },
  ],

  /**
   * Examples of how to customize:
   *
   * ADD A NEW RULE:
   * {
   *   id: 'my-custom-rule',
   *   name: 'My Custom Rule',
   *   type: 'custom',
   *   enabled: true,
   *   match: /your regex pattern/,
   *   violation: 'Description of why this is a problem',
   *   severity: 'error' or 'warning'
   * }
   *
   * DISABLE A RULE:
   * Find it above and set enabled: false
   *
   * MAKE A RULE MORE STRICT/LENIENT:
   * Adjust the regex or return logic in the match function
   */
};
