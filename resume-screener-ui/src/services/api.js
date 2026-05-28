import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://resumescr-funcapp-gaurav-aeafejdsf8h8b6g5.eastus-01.azurewebsites.net/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// JD endpoints
export const getJDs = () => api.get('/jd');
export const getJDById = (jdId) => api.get(`/jd/${jdId}`);
export const uploadJD = (formData) =>
  api.post('/jd', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const uploadJDText = (text, title) =>
  api.post('/jd', { text, title });

// Resume endpoints
export const uploadResumes = (jdId, formData) =>
  api.post(`/resume/upload?jd_id=${jdId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Batch endpoints
export const getBatches = () => api.get('/batches');
export const getBatchStatus = (batchId) => api.get(`/batch/${batchId}/status`);
export const getBatchResults = (batchId, top, sort = 'match_score') =>
  api.get(`/batch/${batchId}/results`, { params: { top, sort } });
export const getBatchExport = (batchId) => api.get(`/batch/${batchId}/export`, { responseType: 'blob' });

// Health
export const healthCheck = () => api.get('/health');

export default api;
