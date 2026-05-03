// Copy this file to config.js and fill in your values.
// config.js is gitignored — never commit your real credentials.
//
// Google OAuth Client ID:  https://console.cloud.google.com/apis/credentials
// Google API Key:          https://console.cloud.google.com/apis/credentials

window.GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';

const GOOGLE_API_CONFIG = {
    API_KEY: 'YOUR_GOOGLE_API_KEY',
    CLIENT_ID: window.GOOGLE_CLIENT_ID,
    DISCOVERY_DOCS: ["https://www.googleapis.com/discovery/v1/apis/docs/v1/rest"],
    SCOPES: 'https://www.googleapis.com/auth/documents.readonly'
};
