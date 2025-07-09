import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    console.log('OntoCode extension is now active!');

    const disposable = vscode.commands.registerCommand('ontocode.edit', async () => {
        const panel = OntoCodePanel.createOrShow(context.extensionUri, context);

        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const document = activeEditor.document;
            if (document.fileName.endsWith('.owl')) {
                const fileContent = document.getText();
                const fileName = path.basename(document.fileName);
                panel.sendFileToWebview(fileName, fileContent);
            }
        }
    });

    context.subscriptions.push(disposable);
}

const TOKEN_KEY = 'ontocode.authToken';

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
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'webview-src', 'dist'),
                    vscode.Uri.joinPath(extensionUri, 'webview-src', 'dist', 'assets')
                ]
            }
        );

        OntoCodePanel.currentPanel = new OntoCodePanel(panel, extensionUri, context);
        return OntoCodePanel.currentPanel;
    }

       private async sendStoredTokenToWebview() {
        try {
            const token = await this._context.secrets.get(TOKEN_KEY); // Retrieve using TOKEN_KEY
            this._panel.webview.postMessage({
                type: 'storedAuthToken', // New message type for webview to receive
                token: token || null // Send null if no token found
            });
            console.log('Extension sent storedAuthToken to webview');
        } catch (e) {
            console.error('Failed to retrieve token from secure storage:', e);
            vscode.window.showErrorMessage('Could not retrieve auth token from secure storage.');
            this._panel.webview.postMessage({ type: 'storedAuthToken', token: null });
        }
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
                    case 'saveFile':
                        this.saveFile(message.fileName, message.content);
                        break;
                    case 'saveAuthToken':
                        if (message.token) {
                            await this._context.secrets.store(TOKEN_KEY, message.token);
                            vscode.window.showInformationMessage('Auth token securely stored!');
                        }
                        return;
                    case 'requestFile':
                        this.handleFileRequest();
                        break;
                    case 'requestAuthToken':
                        await this.sendStoredTokenToWebview();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public sendFileToWebview(fileName: string, content: string) {
        this._panel.webview.postMessage({
            type: 'fileContent',
            fileName,
            content
        });
    }

    private async handleFileRequest() {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('.owl')) {
            const fileContent = activeEditor.document.getText();
            const fileName = path.basename(activeEditor.document.fileName);
            this.sendFileToWebview(fileName, fileContent);
        }
    }

    private async saveFile(fileName: string, content: string) {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const filePath = path.join(workspaceFolder.uri.fsPath, fileName);
                fs.writeFileSync(filePath, content);
                vscode.window.showInformationMessage(`File saved: ${fileName}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error saving file: ${error}`);
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
        this._panel.webview.postMessage({ type: 'requestAuthToken' });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const buildPath = vscode.Uri.joinPath(this._extensionUri, 'webview-src', 'dist');
        const indexPath = vscode.Uri.joinPath(buildPath, 'index.html');

        let htmlContent = '';
        try {
            htmlContent = fs.readFileSync(indexPath.fsPath, 'utf8');
        } catch (error) {
            console.error('Failed to read index.html:', error);
            return `<!DOCTYPE html><html><body><h1>Error loading webview</h1><p>${error}</p></body></html>`;
        }

        const nonce = getNonce();

        const vscodeApiInjectionScript = `
        <script nonce="${nonce}">
            // Acquire the VS Code API
            const vscode = acquireVsCodeApi();
            // Expose it globally to your React app
            window.vscode = vscode;
            console.log("VS Code API injected successfully!"); // Debugging log
        </script>
    `;

        htmlContent = htmlContent.replace(/<meta[^>]*Content-Security-Policy[^>]*>/gi, '');
        htmlContent = htmlContent.replace(
            /(<head>)/,
            `$1
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval'; style-src 'unsafe-inline' ${webview.cspSource}; font-src ${webview.cspSource} data:; connect-src http://localhost:8082 https:;">
            ${vscodeApiInjectionScript}`
        );
        htmlContent = htmlContent.replace(
            /<head.*?>/,
            match =>
                `${match}
                <meta http-equiv="Content-Security-Policy" content="
                    default-src 'none';
                    img-src ${webview.cspSource} https: data: blob:;
                    script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval';
                    style-src 'unsafe-inline' ${webview.cspSource};
                    font-src ${webview.cspSource} data:;
                    connect-src http://localhost:8082 http:;">`
        );

        htmlContent = htmlContent.replace(/(href|src)="([^"]+)"/g, (match, attr, rawPath) => {
            if (rawPath.startsWith('http') || rawPath.startsWith('data:') || rawPath.startsWith('blob:')) {
                return match;
            }

            const resourcePath = rawPath.startsWith('/')
                ? vscode.Uri.joinPath(buildPath, rawPath.slice(1))
                : vscode.Uri.joinPath(buildPath, rawPath);

            const webviewUri = webview.asWebviewUri(resourcePath);
            return `${attr}="${webviewUri}"`;
        });

        htmlContent = htmlContent.replace(/<script(?![^>]*nonce)(.*?)>/g, `<script$1 nonce="${nonce}">`);
        htmlContent = htmlContent.replace(/<style(?![^>]*nonce)(.*?)>/g, `<style$1 nonce="${nonce}">`);

        return htmlContent;
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
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
}

export function deactivate() {}
