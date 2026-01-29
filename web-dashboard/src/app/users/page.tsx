'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  _id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  createdAt: string;
  source?: 'user' | 'worker';
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);

  useEffect(() => {
    const adminData = localStorage.getItem('adminUser');
    if (!adminData) {
      router.push('/auth');
      return;
    }

    try {
      const parsedAdmin = JSON.parse(adminData);
      setAdmin(parsedAdmin);
    } catch {
      router.push('/auth');
      return;
    }

    fetchUsers();
  }, [router]);

  const fetchUsers = async () => {
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    const directUrl = `${apiUrl}/api/users/all-including-workers`;
    const proxyUrl = '/api/proxy/api/users/all-including-workers';

    let res: Response | null = null;
    try {
      res = await fetch(directUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    } catch {
      try {
        res = await fetch(proxyUrl, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      } catch (proxyError) {
        console.error('Error fetching users (direct and proxy failed):', proxyError);
        setUsers([]);
        return;
      }
    }

    try {
      if (res && res.ok) {
        const data = await res.json();
        setUsers(data);
        console.log('Users and workers synced with backend successfully');
      } else {
        setUsers([]);
      }
    } catch (e) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, source?: 'user' | 'worker') => {
    if (source === 'worker') return;
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    let res: Response | null = null;
    try {
      res = await fetch(`${apiUrl}/api/users/${userId}`, { method: 'DELETE' });
    } catch {
      try {
        res = await fetch(`/api/proxy/api/users/${userId}`, { method: 'DELETE' });
      } catch (e) {
        alert('Failed to delete user. Please try again.');
        return;
      }
    }
    if (res?.ok) {
      setUsers(users.filter(user => user._id !== userId));
      alert('User deleted successfully!');
    } else {
      const errorData = await res?.json().catch(() => ({}));
      alert(errorData?.message || 'Failed to delete user. Please try again.');
    }
  };

  const handleClearAllUsers = async () => {
    const nonAdminUsers = users.filter(user => user.role !== 'admin' && user.source === 'user');

    if (nonAdminUsers.length === 0) {
      alert('No customer users to delete (only admin, workers, or no users).');
      return;
    }

    if (!confirm(`Are you sure you want to delete all ${nonAdminUsers.length} customer user(s)? This does not delete workers. This action cannot be undone.`)) {
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    let res: Response | null = null;
    try {
      res = await fetch(`${apiUrl}/api/users/all`, { method: 'DELETE' });
    } catch {
      try {
        res = await fetch('/api/proxy/api/users/all', { method: 'DELETE' });
      } catch (e) {
        alert('Failed to delete all users. Please try again.');
        return;
      }
    }
    if (res?.ok) {
      const data = await res.json();
      setUsers(users.filter(user => user.role === 'admin' || user.source === 'worker'));
      alert(`All ${data.deletedCount} customer users deleted successfully!`);
    } else {
      const errorData = await res?.json().catch(() => ({}));
      alert(errorData?.message || 'Failed to delete all users. Please try again.');
    }
  };

  if (loading || !admin) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">All Users ({users.length})</h3>
            {users.filter(user => user.role !== 'admin' && user.source === 'user').length > 0 && (
              <button
                onClick={handleClearAllUsers}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {user.source === 'worker' ? user.firstName : `${user.firstName} ${user.lastName}`.trim()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.source === 'worker' ? user.email : `@${user.username}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.role === 'admin' ? (
                        <span className="text-gray-400 italic">Hidden</span>
                      ) : (
                        <span>••••••••</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === 'worker'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {user.role !== 'admin' && user.source === 'user' && (
                        <button
                          onClick={() => handleDeleteUser(user._id, `${user.firstName} ${user.lastName}`.trim(), user.source)}
                          className="text-red-600 hover:text-red-900 transition-colors duration-200 p-2 hover:bg-red-50 rounded-lg"
                          title="Delete user"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      {user.role === 'admin' && (
                        <span className="text-gray-400 text-xs">Protected</span>
                      )}
                      {user.source === 'worker' && (
                        <span className="text-gray-400 text-xs">Manage in Workers</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}
