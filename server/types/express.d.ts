import 'express';
import type { TokenPayload } from '../auth';

declare module 'express' {
  interface Request {
    user?: {
      id?: string;
      email?: string;
      role?: string;
      roles?: string | string[];
      daos?: string[];
      claims?: TokenPayload;
    };
    session?: any;
  }
}
