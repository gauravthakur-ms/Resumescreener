/**
 * Auth context provider using MSAL React for Azure AD authentication.
 * Handles session persistence via MSAL localStorage cache and token lifecycle.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './msalConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) {
      const account = accounts[0];
      setUser({
        name: account.name || account.username,
        email: account.username,
        id: account.localAccountId,
      });
      // Set the active account so MSAL knows which account to use for silent calls
      instance.setActiveAccount(account);
    } else {
      setUser(null);
    }
  }, [isAuthenticated, accounts, instance]);

  const login = async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const logout = useCallback(() => {
    // Clear any app-specific cached data before redirecting
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      keysToRemove.push(sessionStorage.key(i));
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));

    instance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin,
    });
  }, [instance]);

  const getAccessToken = async () => {
    if (accounts.length === 0) return null;
    try {
      const response = await instance.acquireTokenSilent({
        scopes: [`api://${import.meta.env.VITE_BACKEND_CLIENT_ID || '0a68a336-7936-4fc8-9f9a-7f0cb6c7dc7a'}/.default`],
        account: accounts[0],
      });
      return response.accessToken;
    } catch (error) {
      // If silent fails (token expired, etc.), trigger redirect
      try {
        await instance.acquireTokenRedirect({
          scopes: [`api://${import.meta.env.VITE_BACKEND_CLIENT_ID || '0a68a336-7936-4fc8-9f9a-7f0cb6c7dc7a'}/.default`],
          account: accounts[0],
        });
      } catch (redirectError) {
        console.error('Token acquisition failed:', redirectError);
      }
      return null;
    }
  };

  const loading = inProgress !== InteractionStatus.None;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, getAccessToken, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
