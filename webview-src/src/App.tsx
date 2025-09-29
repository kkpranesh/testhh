import { useState } from 'react';
import LoginForm from './components/LoginForm';
import SignupForm from './components/SignupForm';
import Dashboard from './components/DahboardForm';
import { useAuth } from './custom-hook/useAuth';
import { FileProvider } from './contexts/FileContexts';

const AppContent = () => {
    const { user, loading } = useAuth();
    const [isLoginView, setIsLoginView] = useState(true);

    const toggleFormView = () => setIsLoginView(!isLoginView);

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    if (user) {
        return <Dashboard />;
    } else {
        return isLoginView ? (
            <LoginForm onToggleForm={toggleFormView} />
        ) : (
            <SignupForm onToggleForm={toggleFormView} />
        );
    }
};

const App = () => {
    return (
        <FileProvider>
            <AppContent />
        </FileProvider>
    );
};

export default App;