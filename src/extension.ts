import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Define the API Gateway URL
const API_GATEWAY_URL = 'http://localhost:8082'; // Your API Gateway's address

export function activate(context: vscode.ExtensionContext) {
    console.log('Protege Extension is now active!');

    // Register the WebviewViewProvider for the sidebar view
    const protegeLoginProvider = new ProtegeLoginViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('protege-login-view', protegeLoginProvider)
    );
}

class ProtegeLoginViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'protege-login-view'; // Must match view ID in package.json

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri, private readonly _context: vscode.ExtensionContext) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Enable JavaScript in the webview
            enableScripts: true,
            // Restrict the webview to only load content from the extension's `webview` directory
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'webview')]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'login':
                        await this.handleLoginRequest(message.username, message.password, webviewView.webview);
                        return;
                    case 'alert': // Example: Webview requests an alert from VS Code
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'getToken': // Webview requests the stored token
                        await this.sendStoredToken(webviewView.webview);
                        return;
                    case 'logout': // Webview requests logout
                        await this.clearStoredToken();
                        webviewView.webview.postMessage({ command: 'loggedOut' });
                        vscode.window.showInformationMessage('Logged out from Protege.');
                        return;
                }
            },
            undefined,
            this._context.subscriptions
        );

        // Send token to webview immediately if already logged in on activation/reload
        this.sendStoredToken(webviewView.webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Local path to the compiled React app's index.html
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'webview', 'index.html');
        let htmlContent = '';
        try {
            htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
        } catch (error) {
            console.error('Failed to read webview HTML file:', error);
            return `<!DOCTYPE html><html lang="en"><body><h1>Error: Webview content not found. Please rebuild the extension.</h1></body></html>`;
        }

        // Replace relative paths in the HTML with webview URIs
        // This is necessary because webviews run in a virtual file system.
        const baseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'static', 'js', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'static', 'css', 'main.css'));

        // Inject the absolute paths into the HTML content
        // This assumes your React build outputs main.js and main.css in static/js and static/css
        const nonce = getNonce(); // Used for Content Security Policy

        return htmlContent
            .replace(/<base href="\/"\/>/, `<base href="${baseUri.toString()}/"/>`)
            .replace(/<link href="\/static\/css\/main.css" rel="stylesheet">/, `<link href="${styleUri}" rel="stylesheet">`)
            .replace(/<script defer="defer" src="\/static\/js\/main.js"><\/script>/, `<script nonce="${nonce}" defer="defer" src="${scriptUri}"></script>`)
            .replace(/<meta http-equiv="Content-Security-Policy" content=".*?"\/>/,
                `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource}; connect-src ${webview.cspSource} ${API_GATEWAY_URL} https://*; media-src ${webview.cspSource}; worker-src 'self';">`
            );
    }

    private async handleLoginRequest(username: string, password: string, webview: vscode.Webview) {
        try {
            const loginUrl = `${API_GATEWAY_URL}/api/auth/login`; // Your API Gateway login endpoint
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json() as { jwt: string };
                const token = data.jwt;
                await this.storeTokenSecurely(token); // Store token using VS Code's SecretStorage
                vscode.window.showInformationMessage('Login successful!');
                webview.postMessage({ command: 'loginSuccess', token: token }); // Notify webview
            } else {
                const errorData = await response.text();
                vscode.window.showErrorMessage(`Login failed: ${errorData}`);
                webview.postMessage({ command: 'loginFailed', error: errorData }); // Notify webview
            }
        } catch (error: any) {
            console.error('Login error:', error);
            vscode.window.showErrorMessage(`Login error: ${error.message || 'Unknown error'}`);
            webview.postMessage({ command: 'loginFailed', error: error.message || 'Unknown error' });
        }
    }

    private async storeTokenSecurely(token: string) {
        // Use VS Code's SecretStorage for secure token storage
        await this._context.secrets.store('protege_jwt_token', token);
    }

    private async getStoredToken(): Promise<string | undefined> {
        return await this._context.secrets.get('protege_jwt_token');
    }

    private async clearStoredToken() {
        await this._context.secrets.delete('protege_jwt_token');
    }

    private async sendStoredToken(webview: vscode.Webview) {
        const token = await this.getStoredToken();
        if (token) {
            webview.postMessage({ command: 'tokenReceived', token: token });
        } else {
            webview.postMessage({ command: 'noToken' });
        }
    }
}

// Utility function for Content Security Policy (CSP) nonce
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function deactivate() {
    console.log('Protege Extension is deactivated.');
}