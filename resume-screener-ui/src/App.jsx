import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import JobDescriptions from './pages/JobDescriptions';
import ResumeUpload from './pages/ResumeUpload';
import Batches from './pages/Batches';
import BatchResults from './pages/BatchResults';

function App() {
  return (
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
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<JobDescriptions />} />
          <Route path="/upload" element={<ResumeUpload />} />
          <Route path="/batches" element={<Batches />} />
          <Route path="/batches/:batchId/results" element={<BatchResults />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
