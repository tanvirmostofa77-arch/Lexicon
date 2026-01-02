import { useState, useEffect } from 'react';
import { databases, APPWRITE_DB_ID, COLLECTIONS } from '../lib/appwrite';
import { studentSchema } from '../lib/schemas';
import { isValidBangladeshPhone } from '../lib/phone';
import { showToast } from '../lib/toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface Student {
  $id: string;
  name: string;
  studentPhone?: string;
  guardianPhone?: string;
  teacherPhone?: string;
  active: boolean;
}

export function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    studentPhone: '',
    guardianPhone: '',
    teacherPhone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);
      const response = await databases.listDocuments(APPWRITE_DB_ID, COLLECTIONS.STUDENTS);
      setStudents(response.documents as Student[]);
    } catch (error) {
      showToast('Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  }

  function validateForm() {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.studentPhone && !isValidBangladeshPhone(formData.studentPhone)) {
      newErrors.studentPhone = 'Invalid Bangladesh phone number';
    }

    if (formData.guardianPhone && !isValidBangladeshPhone(formData.guardianPhone)) {
      newErrors.guardianPhone = 'Invalid Bangladesh phone number';
    }

    if (formData.teacherPhone && !isValidBangladeshPhone(formData.teacherPhone)) {
      newErrors.teacherPhone = 'Invalid Bangladesh phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Please fix form errors', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await databases.createDocument(APPWRITE_DB_ID, COLLECTIONS.STUDENTS, 'unique()', {
        name: formData.name,
        studentPhone: formData.studentPhone || undefined,
        guardianPhone: formData.guardianPhone || undefined,
        teacherPhone: formData.teacherPhone || undefined,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      showToast('Student added successfully', 'success');
      setFormData({ name: '', studentPhone: '', guardianPhone: '', teacherPhone: '' });
      setShowForm(false);
      loadStudents();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add student', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this student?')) return;

    try {
      await databases.deleteDocument(APPWRITE_DB_ID, COLLECTIONS.STUDENTS, id);
      showToast('Student deleted', 'success');
      loadStudents();
    } catch (error) {
      showToast('Failed to delete student', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Students</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Add Student
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Student</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student Phone 
              </label>
              <input
                type="tel"
                placeholder="e.g., 017XXXXXXXX"
                value={formData.studentPhone}
                onChange={(e) => setFormData({ ...formData, studentPhone: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${
                  errors.studentPhone ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.studentPhone && <p className="text-red-500 text-sm mt-1">{errors.studentPhone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guardian Phone
              </label>
              <input
                type="tel"
                placeholder="e.g., 017XXXXXXXX"
                value={formData.guardianPhone}
                onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${
                  errors.guardianPhone ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.guardianPhone && <p className="text-red-500 text-sm mt-1">{errors.guardianPhone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teacher Phone
              </label>
              <input
                type="tel"
                placeholder="e.g., 017XXXXXXXX"
                value={formData.teacherPhone}
                onChange={(e) => setFormData({ ...formData, teacherPhone: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${
                  errors.teacherPhone ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.teacherPhone && <p className="text-red-500 text-sm mt-1">{errors.teacherPhone}</p>}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Student'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No students yet. Add one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Student Phone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Guardian Phone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Teacher Phone</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.$id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">
                      {student.studentPhone || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">
                      {student.guardianPhone || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">
                      {student.teacherPhone || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleDelete(student.$id)}
                        className="text-red-600 hover:text-red-700 transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
