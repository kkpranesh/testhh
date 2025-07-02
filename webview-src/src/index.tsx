import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Optional: for global styles (create this file if needed)

// VS Code Webview API - this is how the webview communicates with the extension
// This function is globally available in VS Code webviews
declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Root element with id 'root' not found");
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App vscode={vscode} />
  </React.StrictMode>
);