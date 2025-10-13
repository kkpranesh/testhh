import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs'; // Import the File System module
import FormData from 'form-data';
import axios from 'axios';
import { insertCitationCommand } from './features/citationInsertion';
import { CitationPickerPanel } from './webview/citationPicker';

const TOKEN_KEY = 'ontocode.authToken';

export function activate(context: vscode.ExtensionContext) {
    console.log('OntoCode extension is now active!');

    const editDisposable = vscode.commands.registerCommand('ontocode.edit', () => {
        const panel = OntoCodePanel.createOrShow(context.extensionUri, context);
        panel.triggerFileUpload();
    });

    const editLargeFileDisposable = vscode.commands.registerCommand('ontocode.editLargeFile', (uri: vscode.Uri) => {
        if (!uri) {
            vscode.window.showErrorMessage("This command should be run by right-clicking an OWL file in the explorer.");
            return;
        }
        const panel = OntoCodePanel.createOrShow(context.extensionUri, context);
        panel.triggerLargeFileUpload(uri);
    });

    const logoutDisposable = vscode.commands.registerCommand('ontocode.logout', async () => {
        await context.secrets.delete(TOKEN_KEY);
        if (OntoCodePanel.currentPanel) {
            OntoCodePanel.currentPanel.dispose();
        }
        vscode.window.showInformationMessage('You have been successfully logged out.');
    });

    const insertCitationDisposable = vscode.commands.registerCommand(
        'ontocode.insertCitation',
        insertCitationCommand
    );
    const citationPickerDisposable = vscode.commands.registerCommand(
        'ontocode.openCitationPicker',
        () => CitationPickerPanel.createOrShow(context.extensionUri)
    );

    context.subscriptions.push(
        editDisposable,
        editLargeFileDisposable,
        logoutDisposable,
        insertCitationDisposable,
        citationPickerDisposable
    );
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
                            await this._context.secrets.store(TOKEN_KEY, message.token);
                            vscode.window.showInformationMessage('Authentication successful.');
                        }
                        return;
                    case 'requestAuthToken':
                        const token = await this._context.secrets.get(TOKEN_KEY);
                        this.postMessage({ type: 'storedAuthToken', token: token || null });
                        return;
                    case 'logout':
                        await this._context.secrets.delete(TOKEN_KEY);
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
    
    public async triggerLargeFileUpload(fileUri: vscode.Uri) {
        console.log(`Triggering large file upload for: ${fileUri.fsPath}`);
        
        const token = await this._context.secrets.get(TOKEN_KEY);
        if (!token) {
            vscode.window.showErrorMessage("You must be logged in to process an ontology.");
            this.postMessage({ type: 'showLogin' });
            return;
        }

        this.postMessage({ type: 'showLoading' });

        const filePath = fileUri.fsPath;
        const fileName = path.basename(filePath);
        const projectId = path.basename(fileName, '.owl');

        try {
            const fileStream = fs.createReadStream(filePath);
            const formData = new FormData();
            
            formData.append('file', fileStream, fileName);
            formData.append('projectId', projectId);

            const headers = {
                'Authorization': `Bearer ${token}`,
                ...formData.getHeaders()
            };

            await axios.post('http://localhost:8082/api/ontology/load', formData, { headers });

            this.postMessage({ type: 'fileReady', projectId: projectId });

        } catch (e: any) {
            const errorMessage = e.response?.data?.error || e.message || 'An unknown error occurred';
            console.error('Error trying to load large ontology on backend:', e);
            vscode.window.showErrorMessage(`Failed to load large ontology on backend: ${errorMessage}`);
            this.postMessage({ type: 'loadingFailed' });
        }
    }

    public async triggerFileUpload() {
        console.log('Triggering file upload...');
        
        const targetEditor = this.findBestOwlEditor();

        if (!targetEditor) {
            vscode.window.showWarningMessage("No active or visible .owl file found. Please click inside the ontology file you wish to edit and try again.");
            return;
        }

        await vscode.window.showTextDocument(targetEditor.document, targetEditor.viewColumn);
        console.log(`Found and focused target editor: ${targetEditor.document.fileName}`);

        const token = await this._context.secrets.get(TOKEN_KEY);
        if (!token) {
            vscode.window.showErrorMessage("You must be logged in to edit an ontology.");
            this.postMessage({ type: 'showLogin' });
            return;
        }

        this.postMessage({ type: 'showLoading' });
        
        const fileContent = targetEditor.document.getText();
        const fileName = path.basename(targetEditor.document.fileName);
        const projectId = path.basename(fileName, '.owl');
        try {
            const formData = new FormData();
            
            const fileBuffer = Buffer.from(fileContent, 'utf-8');
            formData.append('file', fileBuffer, fileName);
            formData.append('projectId', projectId);

            const headers = {
                'Authorization': `Bearer ${token}`,
                ...formData.getHeaders()
            };

            await axios.post('http://localhost:8082/api/ontology/load', formData, { headers });

            this.postMessage({ type: 'fileReady', projectId: projectId });
        } catch (e: any) {
            const errorMessage = e.response?.data?.error || e.message || 'An unknown error occurred';
            console.error('Error trying to load ontology on backend:', e);
            vscode.window.showErrorMessage(`Failed to load ontology on backend: ${errorMessage}`);
            this.postMessage({ type: 'loadingFailed' });
        }
    }

    private findBestOwlEditor(): vscode.TextEditor | undefined {
        const validExtensions = ['.owl'];

        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const fileNameLower = activeEditor.document.fileName.toLowerCase();
            if (validExtensions.some(ext => fileNameLower.endsWith(ext))) {
                return activeEditor;
            }
        }

        for (const editor of vscode.window.visibleTextEditors) {
            const fileNameLower = editor.document.fileName.toLowerCase();
            if (validExtensions.some(ext => fileNameLower.endsWith(ext))) {
                return editor;
            }
        }
        
        return undefined;
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