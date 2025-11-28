'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SidebarLayout from '../../components/SidebarLayout';

type AdminProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  profileImage?: string;
  createdAt: string;
  updatedAt?: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    const loadAdminData = () => {
      try {
        const adminData = localStorage.getItem('adminUser');
        if (!adminData) {
          router.push('/auth');
          return;
        }

        const parsedAdmin = JSON.parse(adminData) as AdminProfile;
        setAdmin(parsedAdmin);
        setFormData({
          name: parsedAdmin.name || '',
          email: parsedAdmin.email || '',
          phone: parsedAdmin.phone || '',
        });
        setProfileImage(parsedAdmin.profileImage || null);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing admin data:', error);
        router.push('/auth');
      }
    };

    loadAdminData();
  }, [router]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select a valid image file' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
        setTimeout(() => setMessage(null), 3000);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result as string;
        setProfileImage(result);
        
        // Auto-save image to localStorage immediately
        if (admin) {
          const updatedAdminData = {
            ...admin,
            profileImage: result,
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem('adminUser', JSON.stringify(updatedAdminData));
          setAdmin(updatedAdminData);
          
          // Dispatch a custom event to notify other components (like SidebarLayout)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('adminProfileUpdated', { 
              detail: updatedAdminData 
            }));
          }
          
          // Try to sync with backend if available
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
            const profilePhotoRes = await fetch(`${apiUrl}/api/users/profile-photo`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: admin.id,
                profilePhoto: result, // Backend uses profilePhoto field
              }),
            });

            if (profilePhotoRes.ok) {
              console.log('Profile photo synced with backend successfully');
            } else {
              console.warn('Backend profile photo sync failed, but profile saved locally');
            }
          } catch (backendError) {
            console.warn('Backend not available, profile saved locally only:', backendError);
          }
        }
        
        setMessage({ type: 'success', text: 'Image uploaded and saved successfully!' });
        setTimeout(() => setMessage(null), 2000);
      };
      reader.onerror = () => {
        setMessage({ type: 'error', text: 'Failed to read image file' });
        setTimeout(() => setMessage(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!admin) return;

    setSaving(true);
    try {
      // For now, we'll update the local storage directly since the backend API might not be ready
      // This provides immediate feedback and works offline
      const updateData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        profileImage: profileImage,
      };

      // Update localStorage with new data
      const updatedAdminData = {
        ...admin,
        ...updateData,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('adminUser', JSON.stringify(updatedAdminData));
      setAdmin(updatedAdminData);
      
      // Dispatch a custom event to notify other components (like SidebarLayout)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('adminProfileUpdated', { 
          detail: updatedAdminData 
        }));
      }

      // Try to sync with backend if available
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        
        // Update profile photo if image was changed
        if (profileImage) {
          const profilePhotoRes = await fetch(`${apiUrl}/api/users/profile-photo`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: admin.id,
              profilePhoto: profileImage, // Backend uses profilePhoto field
            }),
          });

          if (profilePhotoRes.ok) {
            console.log('Profile photo synced with backend successfully');
          } else {
            console.warn('Backend profile photo sync failed, but profile saved locally');
          }
        }

        // Try to update other profile fields (if endpoint exists)
        try {
          const userRes = await fetch(`${apiUrl}/api/users/${admin.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              firstName: formData.name.split(' ')[0],
              lastName: formData.name.split(' ').slice(1).join(' ') || formData.name.split(' ')[0],
              email: formData.email,
              phone: formData.phone,
            }),
          });

          if (userRes.ok) {
            console.log('Profile data synced with backend successfully');
          }
        } catch (updateError) {
          console.warn('Backend profile data sync failed, but profile saved locally');
        }
      } catch (backendError) {
        console.warn('Backend not available, profile saved locally only:', backendError);
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
      setTimeout(() => setMessage(null), 5001);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (loading) {
    return (
      <SidebarLayout adminName="Admin">
        <div className="p-8 flex items-center justify-center min-h-screen">
          <div className="text-xl">Loading...</div>
        </div>
      </SidebarLayout>
    );
  }

  if (!admin) {
    return (
      <SidebarLayout adminName="Admin">
        <div className="p-8 flex items-center justify-center min-h-screen">
          <div className="text-xl">Admin not found</div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout adminName={admin.name || 'Admin'}>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Profile Settings</h3>
              <p className="text-sm text-gray-500">Manage your account information and profile image</p>
              
              {/* Message Display */}
              {message && (
                <div className={`mt-4 p-3 rounded-md ${
                  message.type === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {message.type === 'success' ? (
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">{message.text}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Image Section */}
                <div className="lg:col-span-1">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 mx-auto">
                        {profileImage ? (
                          <img
                            src={profileImage}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="mt-4 text-sm text-gray-500">
                      Click the camera icon to upload a new profile image
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Max file size: 5MB. Supported formats: JPG, PNG, GIF
                    </p>
                  </div>
                </div>

                {/* Profile Information Form */}
                <div className="lg:col-span-2">
                  <form className="space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Full Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your email address"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your phone number"
                      />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-md">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Account Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Role:</span>
                          <span className="ml-2 font-medium text-gray-900">{admin.role}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Member since:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {new Date(admin.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {admin.updatedAt && (
                          <div className="md:col-span-2">
                            <span className="text-gray-500">Last updated:</span>
                            <span className="ml-2 font-medium text-gray-900">
                              {new Date(admin.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-4">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            name: admin.name || '',
                            email: admin.email || '',
                            phone: admin.phone || '',
                          });
                          setProfileImage(admin.profileImage || null);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
