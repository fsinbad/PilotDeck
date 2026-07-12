import { useEffect, useState } from 'react';
import { AUTH_TOKEN_STORAGE_KEY } from '../constants';
import AuthScreenLayout from './AuthScreenLayout';

/**
 * OAuth callback page for DingTalk SSO.
 *
 * The backend redirects here with `token` and `userId` as query parameters
 * after a successful DingTalk OAuth exchange. This component persists the
 * token to localStorage, then performs a full-page redirect to `/` so that
 * `AuthProvider` reinitializes and `checkAuthStatus` runs with the new token.
 */
export default function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userId = params.get('userId');

    if (!token) {
      setError('Authentication failed: no token received from DingTalk.');
      return;
    }

    // Persist the token so AuthProvider can read it on the next page load.
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);

    // Full-page redirect so AuthProvider reinitializes and calls
    // checkAuthStatus with the token already in localStorage.
    window.location.replace('/');
  }, []);

  if (error) {
    return (
      <AuthScreenLayout
        title="Login Failed"
        description={error}
        footerText="Please try again"
      >
        <button
          type="button"
          onClick={() => {
            window.location.href = '/';
          }}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-blue-700"
        >
          Back to Login
        </button>
      </AuthScreenLayout>
    );
  }

  return (
    <AuthScreenLayout
      title="Signing in..."
      description="Completing DingTalk authentication"
      footerText="Please wait"
    >
      <div className="flex items-center justify-center py-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    </AuthScreenLayout>
  );
}
