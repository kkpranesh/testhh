import React, { createContext, useContext, useState, useEffect } from 'react';

// Extend the Window interface to include vscode
declare global {
    interface Window {
        vscode?: {
            postMessage: (message: any) => void;
        };
    }
}

interface User {
    id: number;
    username: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuthStatus();
    }, []);

     useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'storedAuthToken':
                    if (message.token) {
                        localStorage.setItem('authToken', message.token);
                        checkAuthStatus();
                        setUser({} as User);
                    } else {
                        localStorage.removeItem('authToken');
                        setUser(null);
                        setLoading(false);
                    }
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        if (window.vscode) {
            window.vscode.postMessage({ type: 'requestAuthToken' });
        } else {
            checkAuthStatus();
        }


        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const checkAuthStatus = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                const response = await fetch('http://localhost:8082/api/auth/user', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData.data);
                } else {
                    localStorage.removeItem('authToken');
                }
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken');
        } finally {
            setLoading(false);
        }
    };

    const login = async (username: string, password: string) => {
        try {
            const response = await fetch('http://localhost:8082/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                  console.log('here m')
                  if (window.vscode) {
                    console.log('here s')
                    window.vscode.postMessage({
                        type: 'saveAuthToken', // A new message type for the extension
                        token: data.jwt
                    });
                    window.vscode.postMessage({
                        type: 'info',
                        value: 'Login successful! Token sent to VS Code secure storage.'
                    });
                }
                localStorage.setItem('authToken', data.jwt);
                setUser({
                     id: 123,
                    username: 'pranesh',
                    email: 'praneshkk1@gmail.com'
                });
                
                // Send success message to VS Code
                if (window.vscode) {
                    window.vscode.postMessage({
                        type: 'info',
                        value: 'Login successful!'
                    });
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Login failed');
            }
        } catch (error) {
            // Send error message to VS Code
            if (window.vscode) {
                window.vscode.postMessage({
                    type: 'error',
                    value: `Login failed: ${error instanceof Error ? error.message : String(error)}`
                });
            }
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
        
        if (window.vscode) {
            window.vscode.postMessage({
                type: 'info',
                value: 'Logged out successfully'
            });
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};