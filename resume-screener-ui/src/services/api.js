import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://resumescr-funcapp-gaurav-aeafejdsf8h8b6g5.eastus-01.azurewebsites.net/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Bearer token to every request using the shared MSAL instance
let _msalInstance = null;

export function setMsalInstance(instance) {
  _msalInstance = instance;
}

api.interceptors.request.use(async (config) => {
  if (!_msalInstance) return config;
  const accounts = _msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    try {
      const response = await _msalInstance.acquireTokenSilent({
        scopes: [`api://${import.meta.env.VITE_BACKEND_CLIENT_ID || '0a68a336-7936-4fc8-9f9a-7f0cb6c7dc7a'}/.default`],
        account: accounts[0],
      });
      config.headers.Authorization = `Bearer ${response.accessToken}`;
    } catch {
      // Token acquisition failed — request proceeds without auth header
    }
  }
  return config;
});

// JD endpoints
export const getJDs = () => api.get('/jd');
export const getJDById = (jdId) => api.get(`/jd/${jdId}`);
export const deleteJD = (jdId) => api.delete(`/jd/${jdId}`);
export const updateJD = (jdId, data) => api.put(`/jd/${jdId}`, data);
export const updateJDText = (jdId, rawText, metadata = {}) => api.put(`/jd/${jdId}/text`, { raw_text: rawText, ...metadata });
export const uploadJD = (formData) =>
  api.post('/jd', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const uploadJDText = (text, title, project_id, rr_id) =>
  api.post('/jd', { text, title, project_id, rr_id });

// Resume endpoints
export const uploadResumes = (jdId, formData) =>
  api.post(`/resume/upload?jd_id=${jdId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Batch endpoints
export const getBatches = () => api.get('/batches');
export const getBatchStatus = (batchId) => api.get(`/batch/${batchId}/status`);
export const deleteBatch = (batchId) => api.delete(`/batch/${batchId}`);
export const getBatchResults = (batchId, top, sort = 'match_score') =>
  api.get(`/batch/${batchId}/results`, { params: { top, sort } });
export const getBatchExport = (batchId, candidates) => api.post(`/batch/${batchId}/export`, { candidates }, { responseType: 'blob' });

// Screened Resumes / Candidates
export const getCandidatesByJd = (jdId) => api.get(`/jd/${jdId}/candidates`);
export const deleteCandidate = (candidateId, jdId) => api.delete(`/candidate/${candidateId}`, { params: { jd_id: jdId } });
export const getJdExport = (jdId, candidates) => api.post(`/jd/${jdId}/export`, { candidates }, { responseType: 'blob' });
export const downloadResume = (candidateId, jdId) => api.get(`/candidate/${candidateId}/download`, { params: { jd_id: jdId }, responseType: 'blob' });

// Resume Conversion endpoints
export const uploadConversion = (formData) =>
  api.post('/convert', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getConversionStatus = (conversionId) => api.get(`/convert/${conversionId}/status`);
export const getConversion = (conversionId) => api.get(`/convert/${conversionId}`);
export const updateConversion = (conversionId, data) => api.put(`/convert/${conversionId}`, data);
export const downloadConversion = (conversionId) => api.get(`/convert/${conversionId}/download`, { responseType: 'blob' });
export const getConversions = () => api.get('/conversions');
export const deleteConversion = (conversionId) => api.delete(`/convert/${conversionId}`);

// Health
export const healthCheck = () => api.get('/health');

export default api;
