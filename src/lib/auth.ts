import { account, ADMIN_EMAILS } from './appwrite';

export async function getCurrentUser() {
  try {
    const user = await account.get();
    return user;
  } catch {
    return null;
  }
}

export async function isAdminUser(): Promise<boolean> {
  try {
    const user = await account.get();
    return ADMIN_EMAILS.includes(user.email);
  } catch {
    return false;
  }
}

export async function login(email: string, password: string) {
  await account.createEmailSession(email, password);
}

export async function logout() {
  await account.deleteSession('current');
}

