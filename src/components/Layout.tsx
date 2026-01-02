import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../lib/auth';
import { showToast } from '../lib/toast';
import { BarChart3, Users, Settings, LogOut, MessageSquare } from 'lucide-react';

export function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
      showToast('Logged out successfully', 'success');
    } catch (error) {
      showToast('Logout failed', 'error');
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <nav className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col shadow-lg">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold">Lexicon</h2>
          <p className="text-xs text-slate-300 mt-1">{user?.email}</p>
        </div>

        <div className="flex-1 p-4 space-y-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-700 transition"
          >
            <BarChart3 className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/students"
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-700 transition"
          >
            <Users className="w-5 h-5" />
            <span>Students</span>
          </Link>

          <Link
            to="/logs"
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-700 transition"
          >
            <MessageSquare className="w-5 h-5" />
            <span>SMS Logs</span>
          </Link>

          <Link
            to="/settings"
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-700 transition"
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </div>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition font-semibold"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
