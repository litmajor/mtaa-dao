import 'express';
import type { TokenPayload } from '../auth';

type DaoMembershipInfo = {
  id: string | null;
  userId: string | null;
  daoId: string | null;
  role: string | null;
  status: string | null;
  joinedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  isBanned: boolean | null;
  banReason: string | null;
  isElder: boolean | null;
  isAdmin: boolean | null;
  lastActive: Date | null;
  canInitiateWithdrawal: boolean | null;
  canApproveWithdrawal: boolean | null;
  isRotationRecipient: boolean | null;
  rotationRecipientDate: Date | null;
};

type AuthenticatedUser = {
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
  roles?: string | string[];
  daos?: string[];
  isSuperUser?: boolean;
  isSuperuser?: boolean;
  isAdmin?: boolean;
  claims?: TokenPayload & {
    sub?: string;
    isSuperUser?: boolean;
    isSuperuser?: boolean;
    isAdmin?: boolean;
  };
};

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
    daoMembership?: DaoMembershipInfo;
    daoId?: string;
    daoRole?: string;
    session?: any;
  }
}
