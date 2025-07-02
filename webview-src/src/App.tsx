import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import axios from 'axios'; // For API calls

// API Gateway URL - IMPORTANT: MUST MATCH THE ONE IN extension.ts for consistency
// But webview makes calls directly, so it needs its own base URL
const API_GATEWAY_BASE_URL = 'http://localhost:8082';

interface AppProps {
  vscode: any; // Replace 'any' with a more specific type if available
}

function App({ vscode }: AppProps) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Request token from extension on initial load
    vscode.postMessage({ command: 'getToken' });

    // Listen for messages from the VS Code extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'tokenReceived':
          setToken(message.token);
          setLoading(false);
          break;
        case 'noToken':
          setToken(null);
          setLoading(false);
          break;
        case 'loginSuccess':
          setToken(message.token);
          // The token is securely stored by the extension
          // We just update React's state here
          break;
        case 'loggedOut':
          setToken(null);
          break;
        default:
          console.log('Webview: Received unknown message from extension:', message);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [vscode]); // Re-run effect if vscode API changes (unlikely)

  const handleLogin = (username: string, password: string) => {
    // Send login request to the VS Code extension, not directly to API Gateway
    // This allows the extension to handle API calls with fetch/node and secure storage
    vscode.postMessage({
      command: 'login',
      username: username,
      password: password
    });
  };

  const handleLogout = () => {
    // Request logout from the VS Code extension
    vscode.postMessage({ command: 'logout' });
  };

  if (loading) {
    return <div>Loading Protege...</div>;
  }

  return (
    <div className="App">
      {!token ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Dashboard token={token} onLogout={handleLogout} apiBaseUrl={API_GATEWAY_BASE_URL} />
      )}
    </div>
  );
}

export default App;