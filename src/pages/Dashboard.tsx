import { useEffect, useMemo, useState } from 'react';
import { Query } from 'appwrite';
import { Loader2 } from 'lucide-react';

import { databases, functions, APPWRITE_DB_ID, COLLECTIONS } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';
import { showToast } from '../lib/toast';

interface Student {
  $id: string;
  name: string;
  studentPhone?: string;
  guardianPhone?: string;
  teacherPhone?: string;
  active: boolean;
}

type PaymentStatusDb = 'paid' | 'unpaid';
type PaymentStatusUi = 'PAID' | 'UNPAID';

// Raw payment doc coming from Appwrite
type PaymentRaw = any;

interface PaymentNorm {
  $id: string;
  studentId: string; // normalized to student $id
  month: string; // YYYY-MM
  status: PaymentStatusDb;
  $createdAt?: string;
  $updatedAt?: string;
}

function getDefaultMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthOptions() {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = -12; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = `${monthNames[d.getMonth()]} ${year}`;
    months.push({ value, label });
  }

  return months.reverse();
}

/** Normalize ANY month value into YYYY-MM */
function normalizeMonthKey(monthRaw: any): string | null {
  const s = (monthRaw ?? '').toString().trim();
  if (!s) return null;

  // already YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // handle YYYY-M
  if (/^\d{4}-\d{1}$/.test(s)) {
    const [y, m] = s.split('-');
    return `${y}-${m.padStart(2, '0')}`;
  }

  // handle "Jan 2026"
  const m1 = s.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (m1) {
    const mon = m1[1].toLowerCase();
    const year = m1[2];
    const map: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    if (map[mon]) return `${year}-${map[mon]}`;
  }

  // handle "January 2026"
  const m2 = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m2) {
    const mon = m2[1].slice(0, 3).toLowerCase();
    const year = m2[2];
    const map: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    if (map[mon]) return `${year}-${map[mon]}`;
  }

  return null;
}

/**
 * Detect which student field exists in PAYMENTS schema.
 * This avoids: "Invalid query: Attribute not found in schema: studentid"
 */
function detectPaymentStudentFieldFromDocs(docs: PaymentRaw[]): 'studentId' | 'studentid' | 'studentID' {
  const d = docs?.[0];
  if (!d) return 'studentId';
  if ('studentId' in d) return 'studentId';
  if ('studentid' in d) return 'studentid';
  if ('studentID' in d) return 'studentID';
  return 'studentId';
}

function normalizePayment(p: PaymentRaw, studentField: string): PaymentNorm | null {
  const studentId = (p?.[studentField] ?? p?.studentId ?? p?.studentid ?? p?.studentID ?? '').toString().trim();
  const monthKey = normalizeMonthKey(p?.month);
  const statusRaw = (p?.status ?? 'unpaid').toString().toLowerCase().trim();

  if (!studentId || !monthKey) return null;

  const status: PaymentStatusDb = statusRaw === 'paid' ? 'paid' : 'unpaid';

  return {
    $id: p.$id,
    studentId,
    month: monthKey,
    status,
    $createdAt: p.$createdAt,
    $updatedAt: p.$updatedAt,
  };
}

/**
 * If duplicates exist for same (studentId+month), pick best:
 * 1) paid beats unpaid
 * 2) newer updatedAt/createdAt wins
 */
function pickBestPayment(a: PaymentNorm, b: PaymentNorm): PaymentNorm {
  const aPaid = a.status === 'paid';
  const bPaid = b.status === 'paid';

  if (aPaid !== bPaid) return bPaid ? b : a;

  const aTime = Date.parse(a.$updatedAt || a.$createdAt || '') || 0;
  const bTime = Date.parse(b.$updatedAt || b.$createdAt || '') || 0;

  return bTime >= aTime ? b : a;
}

async function waitForExecution(functionId: string, executionId: string, timeoutMs = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const exec: any = await functions.getExecution(functionId, executionId);
    if (exec.status === 'completed' || exec.status === 'failed') return exec;
    await new Promise((r) => setTimeout(r, 700));
  }

  throw new Error('Function timed out (still waiting)');
}

export function Dashboard() {
  const { user } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<PaymentNorm[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());

  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Settings (optional: stored in DB)
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [coachingName, setCoachingName] = useState('Lexicon');
  const [smsTemplateBn, setSmsTemplateBn] = useState(
    'প্রিয় {name}, {month} মাসের কোচিং ফি সফলভাবে গ্রহণ করা হয়েছে। ধন্যবাদ। - {coachingName}'
  );
  const [savingTemplate, setSavingTemplate] = useState(false);

  // ✅ IMPORTANT: the actual field name in PAYMENTS (studentId vs studentid)
  const [paymentStudentField, setPaymentStudentField] = useState<'studentId' | 'studentid' | 'studentID'>('studentId');

  // ✅ status map for selected month
  const paymentMap = useMemo(() => {
    const map = new Map<string, PaymentNorm>();
    for (const p of payments) {
      if (p.month !== selectedMonth) continue;
      const existing = map.get(p.studentId);
      if (!existing) map.set(p.studentId, p);
      else map.set(p.studentId, pickBestPayment(existing, p));
    }
    return map;
  }, [payments, selectedMonth]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    try {
      setLoading(true);

      const [studentsResp, paymentsResp, settingsResp] = await Promise.all([
        databases.listDocuments(APPWRITE_DB_ID, COLLECTIONS.STUDENTS, [Query.limit(5000)]),
        databases.listDocuments(APPWRITE_DB_ID, COLLECTIONS.PAYMENTS, [Query.orderDesc('$updatedAt'), Query.limit(5000)]),
        databases.listDocuments(APPWRITE_DB_ID, COLLECTIONS.SETTINGS, [Query.limit(1)]),
      ]);

      setStudents(studentsResp.documents as Student[]);

      const rawDocs = paymentsResp.documents as PaymentRaw[];
      const detectedField = detectPaymentStudentFieldFromDocs(rawDocs);
      setPaymentStudentField(detectedField);

      const normalized = rawDocs.map((p) => normalizePayment(p, detectedField)).filter(Boolean) as PaymentNorm[];
      setPayments(normalized);

      const s: any = settingsResp.documents?.[0];
      if (s) {
        setSettingsId(s.$id);
        if (typeof s.coachingName === 'string' && s.coachingName.trim()) setCoachingName(s.coachingName);
        if (typeof s.smsTemplateBn === 'string' && s.smsTemplateBn.trim()) setSmsTemplateBn(s.smsTemplateBn);
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }

  function getPaymentStatus(studentId: string): PaymentStatusUi {
    const p = paymentMap.get(studentId);
    return p?.status === 'paid' ? 'PAID' : 'UNPAID';
  }

  async function saveTemplate() {
    if (!settingsId) {
      showToast('Settings document not found. Create 1 row in settings table.', 'error');
      return;
    }

    setSavingTemplate(true);
    try {
      await databases.updateDocument(APPWRITE_DB_ID, COLLECTIONS.SETTINGS, settingsId, {
        coachingName: coachingName.trim(),
        smsTemplateBn: smsTemplateBn.trim(),
      });
      showToast('Template saved', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Failed to save template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  }

  // ✅ AFTER SMS SUCCESS: upsert payment row in DB (using the detected schema key)
  async function upsertPaymentPaid(studentId: string, month: string) {
    const field = paymentStudentField; // detected from actual docs

    // Find existing
    const existing = await databases.listDocuments(APPWRITE_DB_ID, COLLECTIONS.PAYMENTS, [
      Query.equal(field, studentId),
      Query.equal('month', month),
      Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      const doc: any = existing.documents[0];
      await databases.updateDocument(APPWRITE_DB_ID, COLLECTIONS.PAYMENTS, doc.$id, {
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
      return;
    }

    // Create new
    await databases.createDocument(APPWRITE_DB_ID, COLLECTIONS.PAYMENTS, 'unique()', {
      [field]: studentId,
      month,
      status: 'paid',
      paidAt: new Date().toISOString(),
    });
  }

  async function handleMarkPaid(studentId: string) {
  setProcessingId(studentId);

  try {
    if (!user?.email) throw new Error('You are not logged in');

    // 1) Try send SMS (function)
    const functionId = import.meta.env.VITE_APPWRITE_MARKPAID_FN_ID as string | undefined;
    if (!functionId) throw new Error('Missing VITE_APPWRITE_MARKPAID_FN_ID in .env');

    const payload = {
      studentId,
      month: selectedMonth,
      adminEmail: user.email,
      coachingName: coachingName.trim(),
      smsTemplateBn: smsTemplateBn.trim(),
    };

    let smsSent = false;

    try {
      const started: any = await functions.createExecution(functionId, JSON.stringify(payload), true);
      const execution: any = await waitForExecution(functionId, started.$id);

      const statusCode = execution.responseStatusCode;
      const rawBody = (execution.responseBody ?? '').toString();

      if (execution.status !== 'completed') throw new Error(rawBody || 'Execution failed');
      if (typeof statusCode === 'number' && statusCode >= 400) throw new Error(rawBody || `Function failed (${statusCode})`);

      smsSent = true;
    } catch (smsErr: any) {
      // If SMS fails, we DON'T stop the payment toggle.
      // But we show a warning.
      console.error('SMS error:', smsErr);
      showToast('SMS failed (network/SSL). Payment will still be marked as PAID.', 'error');
      smsSent = false;
    }

    // 2) Always upsert payment = paid (source of truth)
    await upsertPaymentPaid(studentId, selectedMonth);

    // 3) Optimistic UI
    setPayments((prev) => {
      const idx = prev.findIndex((p) => p.studentId === studentId && p.month === selectedMonth);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'paid', $updatedAt: new Date().toISOString() };
        return next;
      }
      return [
        ...prev,
        {
          $id: `local_${studentId}_${selectedMonth}`,
          studentId,
          month: selectedMonth,
          status: 'paid',
          $createdAt: new Date().toISOString(),
          $updatedAt: new Date().toISOString(),
        },
      ];
    });

    showToast(smsSent ? 'SMS sent ✅ Payment marked PAID' : 'Payment marked PAID ✅ (SMS not sent)', 'success');

    await loadAll();
  } catch (err: any) {
    console.error(err);
    showToast(err?.message || 'Payment processing failed', 'error');
    await loadAll();
  } finally {
    setProcessingId(null);
  }
}


  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6 space-y-3">
        <h2 className="text-xl font-bold text-gray-900">SMS Template (Bengali)</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coaching Name</label>
            <input
              value={coachingName}
              onChange={(e) => setCoachingName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Example: Lexicon</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Variables</label>
            <div className="text-sm text-gray-600">
              <div>
                <code>{`{name}`}</code> = Student name
              </div>
              <div>
                <code>{`{month}`}</code> = Month text
              </div>
              <div>
                <code>{`{coachingName}`}</code> = Coaching name
              </div>
            </div>
          </div>
        </div>

        <textarea
          value={smsTemplateBn}
          onChange={(e) => setSmsTemplateBn(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          onClick={saveTemplate}
          disabled={savingTemplate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
        >
          {savingTemplate ? 'Saving...' : 'Save Template'}
        </button>

        <div className="text-xs text-gray-500">
          Payments student field detected: <span className="font-mono">{paymentStudentField}</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Dashboard</h1>

        <div className="flex items-center gap-4">
          <label className="font-semibold text-gray-700">Select Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {getMonthOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No students found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Student</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Guardian</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Teacher</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {students.map((student) => {
                  const status = getPaymentStatus(student.$id);
                  const isPaid = status === 'PAID';

                  return (
                    <tr key={student.$id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.name}</td>

                      <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">{student.studentPhone || '-'}</td>

                      <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">{student.guardianPhone || '-'}</td>

                      <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">{student.teacherPhone || '-'}</td>

                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm">
                        {!isPaid && (
                          <button
                            onClick={() => handleMarkPaid(student.$id)}
                            disabled={processingId === student.$id}
                            className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
                          >
                            {processingId === student.$id ? 'Processing...' : 'Mark Paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
