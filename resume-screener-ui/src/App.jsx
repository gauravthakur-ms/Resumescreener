import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import JobDescriptions from './pages/JobDescriptions';
import ResumeUpload from './pages/ResumeUpload';
import Batches from './pages/Batches';
import BatchResults from './pages/BatchResults';
import ScreenedResumes from './pages/ScreenedResumes';
import JDResults from './pages/JDResults';
import ResumeConversion from './pages/ResumeConversion';
import ConversionPreview from './pages/ConversionPreview';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#2A2A2A',
              color: '#fff',
              border: '1px solid #3A3A3A',
            },
          }}
        />
        <AuthenticatedTemplate>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/jobs" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/jobs" element={<JobDescriptions />} />
              <Route path="/upload" element={<ResumeUpload />} />
              <Route path="/screened" element={<ScreenedResumes />} />
              <Route path="/screened/:jdId/results" element={<JDResults />} />
              <Route path="/batches" element={<Batches />} />
              <Route path="/batches/:batchId/results" element={<BatchResults />} />
              <Route path="/convert" element={<ResumeConversion />} />
              <Route path="/convert/:conversionId" element={<ConversionPreview />} />
            </Routes>
          </Layout>
        </AuthenticatedTemplate>
        <UnauthenticatedTemplate>
          <LoginPage />
        </UnauthenticatedTemplate>
      </Router>
    </AuthProvider>
  );
}

export default App;
