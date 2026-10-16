export interface User {
  id: string;
  name?: string | null;
  firstName?: string | null;
  username?: string | null;
  lastName?: string | null;
  email?: string | null;
  profileImageUrl?: string;
  role?: string;
  joinedAt?: string | number | Date;
  isSuperUser?: boolean;
  currentDaoId?: string;
}
