'use client'

import { useState, useEffect } from 'react'

const PASSWORD_KEY = 'wellnesslog_password_set'
const PASSWORD_HASH_KEY = 'wellnesslog_password_hash'
const TRUSTED_DEVICE_KEY = 'wellnesslog_trusted_device'

// Simple hash function (not cryptographically secure, just for basic obfuscation)
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return hash.toString()
}

export function PasswordGate() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSetMode, setIsSetMode] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    // Check if this device is already trusted (unlocked before)
    const trusted = localStorage.getItem(TRUSTED_DEVICE_KEY)
    if (trusted === 'true') {
      setUnlocked(true)
      setLoaded(true)
      return
    }
    const isSet = localStorage.getItem(PASSWORD_KEY)
    if (isSet) {
      setIsSetMode(false)
    } else {
      setIsSetMode(true)
    }
    setLoaded(true)
  }, [])

  if (!loaded || unlocked) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const storedHash = localStorage.getItem(PASSWORD_HASH_KEY)

    if (isSetMode) {
      // Setting a new password
      if (password.length < 4) {
        setError('Password must be at least 4 characters')
        return
      }
      const hash = simpleHash(password)
      localStorage.setItem(PASSWORD_KEY, 'true')
      localStorage.setItem(PASSWORD_HASH_KEY, hash)
      setPassword('')
      setError('')
      setIsSetMode(false)
    } else {
      // Verifying password
      const hash = simpleHash(password)
      if (hash === storedHash) {
        setError('')
        setPassword('')
        // Mark this device as trusted so it won't ask again
        localStorage.setItem(TRUSTED_DEVICE_KEY, 'true')
        setUnlocked(true)
      } else {
        setError('Incorrect password')
        setPassword('')
      }
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 40,
        maxWidth: 400,
        width: '90%',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0d9488', marginBottom: 8 }}>
          WellnessLog.in
        </h1>
        <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
          {isSetMode ? 'Create a password to protect this device' : 'Enter password to continue'}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder={isSetMode ? 'New password' : 'Password'}
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: '2px solid #e2e8f0',
              fontSize: 16,
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: 8,
            }}
            onFocus={(e) => (e.target.style.borderColor = '#0d9488')}
            onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
          />
          {error && (
            <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#0d9488',
              color: 'white',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isSetMode ? 'Set Password' : 'Unlock'}
          </button>
        </form>
        {isSetMode && (
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 16 }}>
            This password protects your device. Store it safely — if lost, you will be locked out.
          </p>
        )}
      </div>
    </div>
  )
}