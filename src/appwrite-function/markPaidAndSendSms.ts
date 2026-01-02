import { Client, Databases, Query, ID } from 'node-appwrite';
import { z } from 'zod';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT!)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const APPWRITE_DB_ID = 'coaching_db';
const COLLECTIONS = {
  STUDENTS: 'students',
  PAYMENTS: 'payments',
  SETTINGS: 'settings',
  SMS_LOGS: 'sms_logs',
};

const inputSchema = z.object({
  studentId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  adminEmail: z.string().email(),
});

function normalizePhone(phone: string): string | null {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('880')) cleaned = cleaned.slice(2);
  if (cleaned.startsWith('88')) cleaned = cleaned.slice(2);
  if (!cleaned.startsWith('017') || cleaned.length !== 10) return null;
  return `+880${cleaned}`;
}

function formatMonthText(month: string): string {
  const [y, m] = month.split('-');
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${names[+m - 1]} ${y}`;
}

async function sendSms(to: string, message: string) {
  const phone = normalizePhone(to);
  if (!phone) return { success: false, response: 'Invalid phone' };

  const res = await fetch(`${process.env.TEXTBEE_BASE_URL}/sms/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TEXTBEE_API_KEY}`,
    },
    body: JSON.stringify({
      device_id: process.env.TEXTBEE_DEVICE_ID,
      phone: phone,
      message: message,
    }),
  });

  const text = await res.text();
  return { success: res.ok, response: text };
}

export default async ({ req, res }: any) => {
  try {
    const data = inputSchema.parse(JSON.parse(req.body));

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
    if (!adminEmails.includes(data.adminEmail)) {
      return res.json({ ok: false, error: 'Unauthorized' }, 403);
    }

    const student = await databases.getDocument(
      APPWRITE_DB_ID,
      COLLECTIONS.STUDENTS,
      data.studentId
    );

    const existing = await databases.listDocuments(
      APPWRITE_DB_ID,
      COLLECTIONS.PAYMENTS,
      [
        Query.equal('studentId', data.studentId),
        Query.equal('month', data.month),
      ]
    );

    if (existing.total > 0) {
      await databases.updateDocument(
        APPWRITE_DB_ID,
        COLLECTIONS.PAYMENTS,
        existing.documents[0].$id,
        { status: 'paid', paidAt: new Date().toISOString() }
      );
    } else {
      await databases.createDocument(
        APPWRITE_DB_ID,
        COLLECTIONS.PAYMENTS,
        ID.unique(),
        { studentId: data.studentId, month: data.month, status: 'paid', paidAt: new Date().toISOString() }
      );
    }

    const settingsResp = await databases.listDocuments(APPWRITE_DB_ID, COLLECTIONS.SETTINGS);
    const s = settingsResp.documents[0] || {};

    const message = `Hi ${student.name}, your coaching fee for ${formatMonthText(data.month)} has been received. Thank you. - ${s.coachingName || 'Coaching Center'}`;

    for (const [type, phone] of [
      ['student', student.studentPhone],
      ['guardian', student.guardianPhone],
      ['teacher', student.teacherPhone],
    ]) {
      if (!phone) continue;
      const r = await sendSms(phone, message);
      await databases.createDocument(
        APPWRITE_DB_ID,
        COLLECTIONS.SMS_LOGS,
        ID.unique(),
        {
          studentId: data.studentId,
          month: data.month,
          recipientType: type,
          toPhone: normalizePhone(phone),
          message,
          status: r.success ? 'sent' : 'failed',
          providerResponse: r.response,
        }
      );
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.json({ ok: false, error: e.message }, 400);
  }
};
