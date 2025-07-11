import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';

const TOKEN_KEY = 'ontocode.authToken';

export function activate(context: vscode.ExtensionContext) {
    console.log('OntoCode extension is now active!');

    const disposable = vscode.commands.registerCommand('ontocode.edit', () => {
        const panel = OntoCodePanel.createOrShow(context.extensionUri, context);
        panel.triggerFileUpload();
    });

     const logoutDisposable = vscode.commands.registerCommand('ontocode.logout', async () => {
        await context.secrets.delete(TOKEN_KEY);

        if (OntoCodePanel.currentPanel) {
            OntoCodePanel.currentPanel.dispose();
        }

        vscode.window.showInformationMessage('You have been successfully logged out.');
    });

    context.subscriptions.push(disposable, logoutDisposable);
}

class OntoCodePanel {
    public static currentPanel: OntoCodePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext): OntoCodePanel {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

        if (OntoCodePanel.currentPanel) {
            OntoCodePanel.currentPanel._panel.reveal(column);
            return OntoCodePanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'ontocodeEditor',
            'OntoCode Editor',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'webview-src', 'dist')]
            }
        );

        OntoCodePanel.currentPanel = new OntoCodePanel(panel, extensionUri, context);
        return OntoCodePanel.currentPanel;
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._context = context;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'info':
                        vscode.window.showInformationMessage(message.value);
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.value);
                        break;
                    case 'saveAuthToken':
                        if (message.token) {
                            console.log('Storing auth token:', message.token);
                            await this._context.secrets.store(TOKEN_KEY, message.token);
                            vscode.window.showInformationMessage('Auth token stored.');
                            this.triggerFileUpload();
                        }
                        return;
                    case 'requestAuthToken':
                        const token = await this._context.secrets.get(TOKEN_KEY);
                        this.postMessage({ type: 'storedAuthToken', token: token || null });
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public postMessage(message: any) {
        this._panel.webview.postMessage(message);
    }

    public async triggerFileUpload() {
        console.log('Triggering file upload...');
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('.owl')) {
            vscode.window.showWarningMessage("To upload, please make sure an .owl file is the active editor tab.");
            return;
        }

        const token = await this._context.secrets.get(TOKEN_KEY);
        if (!token) {
            vscode.window.showErrorMessage("You must be logged in to edit an ontology.");
            this.postMessage({ type: 'showLogin' });
            return;
        }

        this.postMessage({ type: 'showLoading' });
        
        const fileContent = activeEditor.document.getText();
        const projectId = path.basename(activeEditor.document.fileName, '.owl');
        try {
            const formData = new FormData();
            // const fileBlob = new Blob([fileContent], { type: 'application/octet-stream' });
            formData.append('file', fileContent, path.basename(activeEditor.document.fileName));
            formData.append('projectId', projectId);
            await axios.post('http://localhost:8082/api/ontology/load', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });
            this.postMessage({ type: 'fileReady', projectId: projectId });
        } catch (e) {
            console.log(e, 'error trying to load ontology on backend');
            vscode.window.showErrorMessage(`Failed to load ontology on backend: ${e}`);
            this.postMessage({ type: 'loadingFailed' });
        }
    }
    
    private _update() {
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const buildPath = vscode.Uri.joinPath(this._extensionUri, 'webview-src', 'dist');
        const indexPath = vscode.Uri.joinPath(buildPath, 'index.html');
        let htmlContent = fs.readFileSync(indexPath.fsPath, 'utf8');
        const nonce = getNonce();

        const vscodeApiInjectionScript = `
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                window.vscode = vscode;
            </script>
        `;
        htmlContent = htmlContent.replace(/<meta[^>]*Content-Security-Policy[^>]*>/gi, '');
        htmlContent = htmlContent.replace(
            /(<head>)/,
            `$1
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none'; 
                img-src ${webview.cspSource} https: data: blob:; 
                script-src 'nonce-${nonce}'; 
                style-src ${webview.cspSource} 'unsafe-inline'; 
                font-src ${webview.cspSource} data:; 
                connect-src http://localhost:8082;
            ">
            ${vscodeApiInjectionScript}`
        );
        
        htmlContent = htmlContent.replace(/(href|src)="([^"]+)"/g, (match, attr, rawPath) => {
            const resourcePath = vscode.Uri.joinPath(buildPath, rawPath.startsWith('/') ? rawPath.substring(1) : rawPath);
            return `${attr}="${webview.asWebviewUri(resourcePath)}"`;
        });
        
        return htmlContent.replace(/<script/g, `<script nonce="${nonce}"`);
    }

    public dispose() {
        OntoCodePanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            disposable?.dispose();
        }
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}