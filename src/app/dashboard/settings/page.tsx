'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Save, AlertTriangle, Key, User, CreditCard } from 'lucide-react'

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Profile form
  const [fullName, setFullName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser(user)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setFullName((profileData as any).full_name || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleProfileSave = async () => {
    setProfileSaving(true)
    setProfileMessage(null)
    try {
      const res = await fetch('/api/settings/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      setProfileMessage({ type: 'success', text: 'Profile updated successfully.' })
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message })
    }
    setProfileSaving(false)
  }

  const handlePasswordChange = async () => {
    setPasswordSaving(true)
    setPasswordMessage(null)

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' })
      setPasswordSaving(false)
      return
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters.' })
      setPasswordSaving(false)
      return
    }

    try {
      const res = await fetch('/api/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      setPasswordMessage({ type: 'success', text: 'Password changed successfully.' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message })
    }
    setPasswordSaving(false)
  }

  const handleDeleteData = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/settings/delete-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      setShowDeleteConfirm(false)
      setDeleteConfirmText('')
      alert('All your transaction data has been permanently deleted.')
      window.location.reload()
    } catch (err: any) {
      alert('Failed to delete data: ' + err.message)
    }
    setDeleteLoading(false)
  }

  if (loading) {
    return <div className="p-8 flex items-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settings...</div>
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account, password, and subscription.</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <User className="w-5 h-5 mr-2 text-blue-600" /> Account Details
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Enter your full name"
            />
          </div>
          {profileMessage && (
            <div className={`p-3 rounded-md text-sm ${profileMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {profileMessage.text}
            </div>
          )}
          <button
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center"
          >
            {profileSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Key className="w-5 h-5 mr-2 text-blue-600" /> Change Password
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Minimum 8 characters"
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Repeat new password"
              minLength={8}
            />
          </div>
          {passwordMessage && (
            <div className={`p-3 rounded-md text-sm ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {passwordMessage.text}
            </div>
          )}
          <button
            onClick={handlePasswordChange}
            disabled={passwordSaving || !newPassword}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center"
          >
            {passwordSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
            Update Password
          </button>
        </div>
      </div>

      {/* Subscription Section */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CreditCard className="w-5 h-5 mr-2 text-blue-600" /> Subscription
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">
              Status: <span className="font-medium capitalize text-gray-900">{profile?.subscription_status || 'trialing'}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {profile?.subscription_end_date
                ? <>Renews: <span className="font-medium text-gray-900">{new Date(profile.subscription_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></>
                : profile?.trial_end_date
                  ? <>Trial ends: <span className="font-medium text-gray-900">{new Date(profile.trial_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></>
                  : null
              }
            </div>
          </div>
          
          {profile?.stripe_customer_id ? (
            <form action="/api/stripe/create-portal" method="POST">
              <button type="submit" className="px-4 py-2 border rounded-md font-medium text-sm hover:bg-gray-50 flex items-center">
                Manage Billing
              </button>
            </form>
          ) : (
            <button 
              onClick={async (e) => {
                const btn = e.currentTarget
                btn.disabled = true
                btn.innerHTML = 'Loading...'
                try {
                  const res = await fetch('/api/stripe/create-checkout', { method: 'POST' })
                  const data = await res.json()
                  if (data.url) window.location.assign(data.url)
                  else throw new Error(data.error)
                } catch(err: any) {
                  alert(err.message || 'Failed to create checkout session')
                  btn.disabled = false
                  btn.innerHTML = 'Upgrade to Pro'
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 flex items-center"
            >
              Upgrade to Pro
            </button>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <h3 className="text-lg font-semibold text-red-600 mb-2 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" /> Danger Zone
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Permanently delete all your transaction data, computations, and uploaded records. This action cannot be undone. Your account will remain active.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 border border-red-200 text-red-600 rounded-md font-medium text-sm hover:bg-red-50"
          >
            Delete All My Data
          </button>
        ) : (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200 space-y-3">
            <p className="text-sm font-medium text-red-800">
              Type <strong>DELETE</strong> to confirm the permanent deletion of all your data.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-red-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500"
              placeholder="Type DELETE to confirm"
            />
            <div className="flex gap-3">
              <button
                onClick={handleDeleteData}
                disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center"
              >
                {deleteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Permanently Delete
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
