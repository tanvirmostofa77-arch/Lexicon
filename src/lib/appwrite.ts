import { Client, Account, Databases, Functions } from 'appwrite';

export const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const functions = new Functions(client); // ✅ ADD THIS

export const APPWRITE_DB_ID = 'coaching_db';

export const COLLECTIONS = {
  STUDENTS: 'students',
  PAYMENTS: 'payments',
  SETTINGS: 'settings',
  SMS_LOGS: 'sms_logs',
};

export const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim());
