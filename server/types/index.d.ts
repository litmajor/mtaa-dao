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
  const web3: any;
  export = web3;
}

declare module 'ethers' {
  const ethers: any;
  export = ethers;
}

export {};
