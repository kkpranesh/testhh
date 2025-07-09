
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LoginForm from './components/LoginForm';
import Dashboard from './components/DahboardForm';
import { AuthProvider, useAuth } from './contexts/AuthContexts';
import { FileProvider } from './contexts/FileContexts';
import './index.css';

const App = () => {
    return (
        <AuthProvider>
            <FileProvider>
                <AppContent />
            </FileProvider>
        </AuthProvider>
    );
};

const AppContent = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="app">
            {user ? <Dashboard /> : <LoginForm />}
        </div>
    );
};


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)



