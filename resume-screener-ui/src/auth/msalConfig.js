/**
 * MSAL configuration for Azure AD authentication.
 */

const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID;
const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID;
const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin;
const postLogoutRedirectUri = import.meta.env.VITE_POST_LOGOUT_REDIRECT_URI || window.location.origin;

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['User.Read'],
};
