/**
 * Global type declarations
 */

// NOTE: Express `Request` augmentation is declared in `server/types/express.d.ts`
// to serve as the single source-of-truth for `Request.user`.

declare module 'web3' {
  const web3: any;
  export = web3;
}

declare module 'ethers' {
  const ethers: any;
  export = ethers;
}

// Minimal Next.js API type placeholders used by server route handlers
declare module 'next' {
  import type { RequestHandler } from 'express';
  export type NextApiRequest = any;
  export type NextApiResponse = any;
}

export {};

declare module 'web3' {
  const web3: any;
  export = web3;
}

declare module 'ethers' {
  const ethers: any;
  export = ethers;
}

// Provide a minimal declaration to satisfy imports of lucide-react in the client
declare module 'lucide-react' {
  const content: any;
  export default content;
}

// Minimal Next.js API type placeholders used by server route handlers
declare module 'next' {
  import type { RequestHandler } from 'express';
  export type NextApiRequest = any;
  export type NextApiResponse = any;
}

export {};
