/**
 * Global type declarations
 */

// Extend Express Request with user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
        claims?: any;
      };
    }
  }
}

// Declare missing types for third-party libraries
declare module 'web3' {
  export const default: any;
}

declare module 'ethers' {
  export const default: any;
}

export {};
