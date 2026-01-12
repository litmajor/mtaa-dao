export interface User {
  id: string;
  firstName: string;
  username: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
  role?: string;
  joinedAt?: string | number | Date;
  isSuperUser?: boolean;
  currentDaoId?: string;
}
