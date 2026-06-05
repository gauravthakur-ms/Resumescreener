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
export const deleteJD = (jdId) => api.delete(`/jd/${jdId}`);
export const updateJD = (jdId, data) => api.put(`/jd/${jdId}`, data);
export const updateJDText = (jdId, rawText) => api.put(`/jd/${jdId}/text`, { raw_text: rawText });
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

// Health
export const healthCheck = () => api.get('/health');

export default api;
