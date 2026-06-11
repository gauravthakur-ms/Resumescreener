import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './auth/msalConfig'
import { setMsalInstance } from './services/api'
import './index.css'
import App from './App.jsx'

const msalInstance = new PublicClientApplication(msalConfig);

async function startApp() {
  try {
    await msalInstance.initialize();
    
    const response = await msalInstance.handleRedirectPromise();
    if (response) {
      msalInstance.setActiveAccount(response.account);
    } else {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      }
    }
  } catch (error) {
    console.error('MSAL initialization error:', error);
    // Clear the hash to avoid infinite loop on failed redirects
    if (window.location.hash.includes('code=')) {
      window.location.hash = '';
    }
  }

  // Share the initialized MSAL instance with the API interceptor
  setMsalInstance(msalInstance);

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  );
}

startApp();
