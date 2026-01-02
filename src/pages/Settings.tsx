import { useState, useEffect } from 'react';
import { databases, APPWRITE_DB_ID, COLLECTIONS } from '../lib/appwrite';
import { showToast } from '../lib/toast';
import { Loader2 } from 'lucide-react';

interface SettingsData {
  $id: string;
  coachingName: string;
  sendToStudent: boolean;
  sendToGuardian: boolean;
  sendToTeacher: boolean;
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    coachingName: '',
    sendToStudent: true,
    sendToGuardian: true,
    sendToTeacher: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const response = await databases.listDocuments(APPWRITE_DB_ID, COLLECTIONS.SETTINGS);

      if (response.documents.length > 0) {
        const existing = response.documents[0] as SettingsData;
        setSettings(existing);
        setFormData({
          coachingName: existing.coachingName || '',
          sendToStudent: existing.sendToStudent ?? true,
          sendToGuardian: existing.sendToGuardian ?? true,
          sendToTeacher: existing.sendToTeacher ?? false,
        });
      } else {
        setFormData({
          coachingName: '',
          sendToStudent: true,
          sendToGuardian: true,
          sendToTeacher: false,
        });
      }
    } catch (error) {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.coachingName.trim()) {
      showToast('Coaching name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (settings) {
        await databases.updateDocument(APPWRITE_DB_ID, COLLECTIONS.SETTINGS, settings.$id, {
          coachingName: formData.coachingName,
          sendToStudent: formData.sendToStudent,
          sendToGuardian: formData.sendToGuardian,
          sendToTeacher: formData.sendToTeacher,
        });
      } else {
        await databases.createDocument(APPWRITE_DB_ID, COLLECTIONS.SETTINGS, 'unique()', {
          coachingName: formData.coachingName,
          sendToStudent: formData.sendToStudent,
          sendToGuardian: formData.sendToGuardian,
          sendToTeacher: formData.sendToTeacher,
        });
      }

      showToast('Settings saved successfully', 'success');
      loadSettings();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
        {loading ? (
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Coaching Name</label>
              <input
                type="text"
                value={formData.coachingName}
                onChange={(e) => setFormData({ ...formData, coachingName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                required
              />
            </div>

            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900">SMS Recipients</h3>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="student"
                  checked={formData.sendToStudent}
                  onChange={(e) => setFormData({ ...formData, sendToStudent: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="student" className="text-gray-700 cursor-pointer flex-1">
                  Send SMS to Student Phone
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="guardian"
                  checked={formData.sendToGuardian}
                  onChange={(e) => setFormData({ ...formData, sendToGuardian: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="guardian" className="text-gray-700 cursor-pointer flex-1">
                  Send SMS to Guardian Phone
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="teacher"
                  checked={formData.sendToTeacher}
                  onChange={(e) => setFormData({ ...formData, sendToTeacher: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="teacher" className="text-gray-700 cursor-pointer flex-1">
                  Send SMS to Teacher Phone
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
