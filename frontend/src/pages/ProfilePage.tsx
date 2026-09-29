import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { TopNavbar } from '../components/layout/TopNavbar';
import { getUserOrContactName, formatPhoneNumber } from '../lib/formatters';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated, isLoading: authLoading, logout, setUser } = useAuth();

  // Edit panel toggle
  const [isEditing, setIsEditing] = useState(false);

  // Form states for profile editing
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [dob, setDob] = useState(user?.dob || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(user?.profilePictureUrl || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Status states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync form when user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setDob(user.dob || '');
      setGender(user.gender || '');
      setProfilePictureUrl(user.profilePictureUrl || '');
      setAvatarFile(null);
      setAvatarPreview(null);
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-slate-600">
        <div className="flex flex-col items-center space-y-3">
          <img
            src="/sandesh-wordmark.png"
            alt="संदेश"
            className="h-14 w-auto object-contain mb-2 dark:brightness-0 dark:invert dark:opacity-95"
          />
          <div className="h-7 w-7 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !token) {
    return <Navigate to="/login" replace />;
  }

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(user.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(user.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setSaveError('Please select a valid image file (PNG, JPG, WEBP, GIF)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setSaveError('Image file size must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      setSaveError(null);
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);
    }
  };

  const handleRemovePhoto = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setProfilePictureUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      let finalAvatarUrl = profilePictureUrl.trim() || null;

      // 1. If an image file was selected, upload it via /api/me/avatar
      if (avatarFile) {
        const uploadRes = await api.uploadAvatar(avatarFile, token);
        finalAvatarUrl = uploadRes.profilePictureUrl;
      }

      // 2. Save profile fields (name/displayName, dob, gender, profilePictureUrl)
      const response = await api.updateMe(
        {
          displayName: displayName.trim(),
          dob: dob || null,
          gender: gender || null,
          profilePictureUrl: finalAvatarUrl,
        },
        token
      );

      setUser(response.user);
      setSaveSuccess(true);
      setAvatarFile(null);
      setAvatarPreview(null);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 1200);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setDisplayName(user.displayName || '');
    setDob(user.dob || '');
    setGender(user.gender || '');
    setProfilePictureUrl(user.profilePictureUrl || '');
    setAvatarFile(null);
    setAvatarPreview(null);
    setShowUrlInput(false);
    setSaveError(null);
    setIsEditing(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const displayNameOrUsername = getUserOrContactName(user);
  const initials = displayNameOrUsername.slice(0, 2).toUpperCase();

  // Format DOB display
  const formatDob = (dobStr?: string | null) => {
    if (!dobStr) return { formatted: 'Not provided', age: null };
    const date = new Date(dobStr);
    if (isNaN(date.getTime())) return { formatted: dobStr, age: null };

    const formatted = date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const now = new Date();
    let age = now.getFullYear() - date.getFullYear();
    const m = now.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
      age--;
    }
    return { formatted, age: age >= 0 ? age : null };
  };

  // Format Gender display
  const formatGender = (g?: string | null) => {
    switch (g?.toLowerCase()) {
      case 'male':
        return { label: 'Male', icon: '♂', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 border-blue-200/80 dark:border-blue-900/60' };
      case 'female':
        return { label: 'Female', icon: '♀', color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/50 border-pink-200/80 dark:border-pink-900/60' };
      case 'other':
        return { label: 'Non-binary / Other', icon: '⚧', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50 border-purple-200/80 dark:border-purple-900/60' };
      case 'prefer_not_to_say':
        return { label: 'Prefer not to say', icon: '•', color: 'text-slate-600 bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700' };
      default:
        return { label: 'Not specified', icon: '•', color: 'text-slate-500 bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700' };
    }
  };

  const dobInfo = formatDob(user.dob);
  const genderInfo = formatGender(user.gender);

  // Active display avatar (preview takes precedence during edit, then user.profilePictureUrl)
  const currentAvatarSrc = avatarPreview || profilePictureUrl || user.profilePictureUrl;

  return (
    <div className="min-h-screen bg-[#f4f5f9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-[#d7ebfc] dark:selection:bg-sky-900 transition-colors duration-200">
      {/* Top Navbar */}
      <TopNavbar user={user} onLogout={handleLogout} showBackToInbox={true} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        {/* Profile Hero Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.45)] relative overflow-hidden transition-colors duration-200">
          {/* Subtle ambient background glow matching login and dashboard waves */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-500/10 dark:from-blue-600/15 via-indigo-500/5 to-transparent rounded-full blur-2xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 text-center sm:text-left">
            {/* Avatar & Online Badge — Circular, Synced with Dashboard & Login */}
            <div className="relative flex-shrink-0 group">
              {currentAvatarSrc ? (
                <img
                  src={currentAvatarSrc}
                  alt={user.displayName || 'Avatar'}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover shadow-lg shadow-blue-500/10 ring-4 ring-white dark:ring-slate-800 border border-slate-200/60 dark:border-slate-700"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl sm:text-3xl font-bold tracking-wider shadow-lg shadow-blue-500/25 ring-4 ring-white dark:ring-slate-800 border border-blue-400/30 select-none">
                  {initials}
                </div>
              )}

              {/* Edit overlay trigger when in edit mode */}
              {isEditing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-slate-950/50 hover:bg-slate-950/65 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-[2px]"
                  title="Upload new image"
                >
                  <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-[10px] font-semibold">Change</span>
                </button>
              )}
            </div>

            {/* Profile Header Info */}
            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  {user.displayName || displayNameOrUsername}
                </h1>

                {/* Edit Mode Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsEditing((v) => !v)}
                  title={isEditing ? 'Close editor' : 'Edit profile'}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95 ${
                    isEditing
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-inner'
                      : 'bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60'
                  }`}
                >
                  {isEditing ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Close</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <span>Edit Details</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Contact & Info Chips */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="font-mono">{formatPhoneNumber(user.phone)}</span>
                  <button
                    type="button"
                    onClick={handleCopyPhone}
                    className="ml-1 text-[11px] font-medium text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition cursor-pointer"
                    title="Copy phone"
                  >
                    {copiedPhone ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                    ) : (
                      'Copy'
                    )}
                  </button>
                </div>

                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px] sm:max-w-xs">{user.email}</span>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="ml-1 text-[11px] font-medium text-[#0369a1] dark:text-sky-400 hover:underline transition cursor-pointer"
                    title="Copy email"
                  >
                    {copiedEmail ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                    ) : (
                      'Copy'
                    )}
                  </button>
                </div>

                {user.gender && (
                  <div className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-medium border ${genderInfo.color}`}>
                    <span>{genderInfo.icon}</span>
                    <span>{genderInfo.label}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Edit Form */}
          {isEditing && (
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update your personal details and profile photo.
                </p>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {saveSuccess && (
                <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl p-3.5 text-xs flex items-center space-x-2.5">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Profile updated successfully!</span>
                </div>
              )}

              {saveError && (
                <div className="mb-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl p-3.5 text-xs flex items-center space-x-2.5">
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{saveError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* 1. Avatar File / Photo Selection Section */}
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Profile Picture
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Thumbnail preview */}
                    <div className="relative">
                      {currentAvatarSrc ? (
                        <img
                          src={currentAvatarSrc}
                          alt="Avatar preview"
                          className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-800 ring-2 ring-blue-500/20 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-blue-500/20 ring-2 ring-white dark:ring-slate-800 border border-blue-400/30 select-none">
                          {initials}
                        </div>
                      )}
                      {avatarFile && (
                        <span className="absolute -top-0.5 -right-0.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                          New
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                      />
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span>Choose from Files</span>
                        </button>

                        {currentAvatarSrc && (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Remove</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setShowUrlInput((v) => !v)}
                          className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline px-1 py-1 cursor-pointer"
                        >
                          {showUrlInput ? 'Hide URL input' : 'Or paste image URL'}
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Supports JPEG, PNG, WEBP, GIF up to 5MB.
                      </p>

                      {showUrlInput && (
                        <div className="pt-1">
                          <input
                            type="url"
                            value={profilePictureUrl}
                            onChange={(e) => {
                              setProfilePictureUrl(e.target.value);
                              setAvatarFile(null);
                              setAvatarPreview(null);
                            }}
                            placeholder="https://example.com/avatar.jpg"
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Form Fields Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name field */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Full Name / Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Himesh Jadav"
                      maxLength={100}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 transition"
                    />
                  </div>

                  {/* Date of Birth field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 transition"
                    />
                  </div>

                  {/* Gender selection field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 transition"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Non-binary / Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/80 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20 transition active:scale-98 disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                  >
                    {isSaving && <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* View Mode: Account Identity & User Details Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.03)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.45)] space-y-5 transition-colors duration-200">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                User Details &amp; Identity
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Personal credentials and account details linked to your Sandesh account.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {/* 1. Full Name */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Full Name
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block truncate">
                {user.displayName || <span className="text-slate-400 italic font-normal">Not provided</span>}
              </span>
            </div>

            {/* 2. Gender */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Gender
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {genderInfo.label}
                </span>
                {user.gender && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium border ${genderInfo.color}`}>
                    {genderInfo.icon}
                  </span>
                )}
              </div>
            </div>

            {/* 3. Date of Birth */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Date of Birth
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {dobInfo.formatted}
                </span>
                {dobInfo.age !== null && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                    ({dobInfo.age} yrs)
                  </span>
                )}
              </div>
            </div>

            {/* 4. Authenticated Phone */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start justify-between space-x-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/80">
              <div className="space-y-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Authenticated Phone
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 block truncate">
                  {formatPhoneNumber(user.phone)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition text-xs font-medium cursor-pointer"
                title="Copy phone"
              >
                {copiedPhone ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>

            {/* 5. Sandesh Address */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-start justify-between space-x-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/80">
              <div className="space-y-1 min-w-0">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Sandesh Address
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 block truncate" title={user.email}>
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition text-xs font-medium cursor-pointer"
                title="Copy email"
              >
                {copiedEmail ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>

            {/* 6. Account Created */}
            <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 space-y-1 transition hover:bg-slate-50 dark:hover:bg-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Account Created
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Recent'}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Sign Out Action */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full sm:w-auto min-w-[240px] flex items-center justify-center space-x-2 py-3 px-6 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:bg-rose-200/80 border border-rose-200/80 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs font-semibold rounded-2xl transition-all duration-150 shadow-xs active:scale-98 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out of Sandesh</span>
          </button>
        </div>
      </main>
    </div>
  );
};
