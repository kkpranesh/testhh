/* eslint-disable @typescript-eslint/no-explicit-any */
// src/contexts/AuthContexts.tsx

import React, { useState, useEffect } from 'react';
import { AuthContext } from '../custom-hook/useAuth';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'storedAuthToken':
                    if (message.token) {
                        localStorage.setItem('authToken', message.token);
                        setUser({ id: 123, username: 'pranesh', email: 'praneshkk1@gmail.com' });
                    } else {
                        localStorage.removeItem('authToken');
                        setUser(null);
                    }
                    setLoading(false);
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        if (window.vscode) {
            window.vscode.postMessage({ type: 'requestAuthToken' });
        } else {
            // Fallback for non-VS Code environment
            const token = localStorage.getItem('authToken');
            if (token) {
                setUser({ id: 123, username: 'pranesh', email: 'praneshkk1@gmail.com' });
            }
            setLoading(false);
        }
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const login = async (username: string, password: string) => {
        try {
            const response = await fetch('http://localhost:8082/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                if (window.vscode) {
                    window.vscode.postMessage({ type: 'saveAuthToken', token: data.jwt });
                    window.vscode.postMessage({ type: 'info', value: 'Login successful! Token sent to VS Code secure storage.' });
                }
                localStorage.setItem('authToken', data.jwt);
                setUser({ id: 123, username: 'pranesh', email: 'praneshkk1@gmail.com' });
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Login failed');
            }
        } catch (error) {
            if (window.vscode) {
                window.vscode.postMessage({ type: 'error', value: `Login failed: ${error instanceof Error ? error.message : String(error)}` });
            }
            throw error;
        }
    };

    const signup = async (username: string, email: string, password: string) => {
        try {
            const response = await fetch('http://localhost:8082/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            if (response.ok) {
                const data = await response.json();
                if (window.vscode) {
                    window.vscode.postMessage({
                        type: 'info',
                        value: data.message || 'Signup successful! Please check your email to verify your account.'
                    });
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Signup failed.');
            }
        } catch (error) {
            if (window.vscode) {
                window.vscode.postMessage({
                    type: 'error',
                    value: `Signup failed: ${error instanceof Error ? error.message : String(error)}`
                });
            }
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
        if (window.vscode) {
            window.vscode.postMessage({ type: 'info', value: 'Logged out successfully' });
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
};