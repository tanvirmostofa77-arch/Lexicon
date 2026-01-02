import { useState, useEffect } from 'react';
import { databases, APPWRITE_DB_ID, COLLECTIONS } from '../lib/appwrite';
import { showToast } from '../lib/toast';
import { Query } from 'appwrite';
import { Loader2, ChevronDown } from 'lucide-react';

interface SmsLog {
  $id: string;
  studentId: string;
  month: string;
  toPhone: string;
  recipientType: string;
  message: string;
  status: string;
  providerResponse: string;
  createdAt?: string;
}

export function Logs() {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function getDefaultMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  useEffect(() => {
    loadLogs();
  }, [selectedMonth, statusFilter]);

  async function loadLogs() {
    try {
      setLoading(true);
      const queries = [Query.equal('month', selectedMonth)];
      if (statusFilter !== 'all') {
        queries.push(Query.equal('status', statusFilter));
      }

      const response = await databases.listDocuments(APPWRITE_DB_ID, COLLECTIONS.SMS_LOGS, queries);
      setLogs(response.documents as SmsLog[]);
    } catch (error) {
      showToast('Failed to load logs', 'error');
    } finally {
      setLoading(false);
    }
  }

  function getMonthOptions() {
    const months = [];
    const now = new Date();
    for (let i = -12; i <= 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const value = `${year}-${month}`;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[d.getMonth()]} ${year}`;
      months.push({ value, label });
    }
    return months.reverse();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">SMS Logs</h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'sent' | 'failed')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No logs found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map((log) => (
              <div key={log.$id} className="p-4">
                <div
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
                  onClick={() => setExpandedId(expandedId === log.$id ? null : log.$id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block px-3 py-1 rounded text-xs font-semibold ${
                          log.status === 'sent'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                      <span className="font-mono text-sm text-gray-600">{log.toPhone}</span>
                      <span className="text-xs text-gray-500">({log.recipientType})</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-1">{log.message}</p>
                  </div>

                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition ${
                      expandedId === log.$id ? 'transform rotate-180' : ''
                    }`}
                  />
                </div>

                {expandedId === log.$id && (
                  <div className="bg-gray-50 p-4 mt-2 rounded space-y-2 border-l-4 border-blue-500">
                    <div>
                      <p className="text-xs text-gray-500 font-semibold">MESSAGE</p>
                      <p className="text-sm text-gray-700 mt-1">{log.message}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-semibold">PROVIDER RESPONSE</p>
                      <p className="text-xs text-gray-600 font-mono mt-1 overflow-auto max-h-24">
                        {log.providerResponse}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
