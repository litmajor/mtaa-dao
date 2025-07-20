export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
  role?: string;
  joinedAt?: string | number | Date;
}
