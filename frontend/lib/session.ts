export type UserSession = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  profilePhoto?: string;
};

let cachedUser: UserSession | null = null;

export function setCurrentUser(user: UserSession | null) {
  cachedUser = user;
}

export function getCurrentUser(): UserSession | null {
  return cachedUser;
}


