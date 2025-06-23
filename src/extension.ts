import * as vscode from 'vscode';
import { LaravelModelsProvider, ModelItem } from './laravelModelsProvider';
import { LaravelProjectDetector } from './laravelProjectDetector';
import ModelTemplate from './templates/model';


let modelsProvider: LaravelModelsProvider;

type ComposerJson = {
    name: string;
    description: string;
    keywords: string[];
    license: string;
    type: string;

    require: Record<string, string>;
    "require-dev": Record<string, string>;

    autoload: {
        "psr-4": Record<string, string>;
        classmap: string[];
        files: string[];
    };

    "autoload-dev": {
        "psr-4": Record<string, string>;
    };
};

function json_parser(json: string): any {
    try {
        return JSON.parse(json);
    } catch (error) {
        console.error("Error parsing JSON:", error);
        return null;
    }
};

export async function activate(context: vscode.ExtensionContext) {
    // Detectar si es un proyecto Laravel
    const isLaravel = LaravelProjectDetector.isLaravelProject();

    if (!isLaravel) {
        return;
    }

    vscode.commands.executeCommand('setContext', 'laravelProject', true);

    // Inicializar el proveedor de modelos
    modelsProvider = new LaravelModelsProvider();

    // Registrar el tree view
    const treeView = vscode.window.createTreeView('laravelModels', {
        treeDataProvider: modelsProvider,
        showCollapseAll: true
    });

    // Registrar comandos
    const refreshCommand = vscode.commands.registerCommand('laravelModels.refresh', async () => {
        await modelsProvider.refresh();
    });

    const openModelCommand = vscode.commands.registerCommand('laravelModels.openModel', (model: ModelItem) => {
        if (model.resourceUri) {
            vscode.window.showTextDocument(model.resourceUri);
        }
    });

    const createModelCommand = vscode.commands.registerCommand('laravelModels.createModel', async () => {
        const modelName = await vscode.window.showInputBox({
            prompt: 'Model name (e.g., User, Post, Category)',
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Model name cannot be empty';
                }
                if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
                    return 'Name must start with an uppercase letter and contain only letters and numbers';
                }
                return null;
            }
        });

        if (modelName) {
            await createNewModel(modelName);
        }
    });

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
        return;
    }

    const config = vscode.workspace.getConfiguration('laravelModelsExplorer');

    if (config.get('autoRefresh', true)) {

        const composerJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'composer.json');

        const composerDocument = await vscode.workspace.openTextDocument(composerJsonUri);
        const composerContent = composerDocument.getText();

        const { autoload: { "psr-4": namespaces } }: ComposerJson = json_parser(composerContent) as ComposerJson;

        Object.entries(namespaces).forEach(async ([, namespacePath]: [string, string]) => {
            const watcher = vscode.workspace.createFileSystemWatcher(`${workspaceFolder.uri.fsPath}/${namespacePath}**/*.php`);
            const processedUris = new Set<string>();

            const autoRefreshHandler = async (uri: vscode.Uri) => {
                const filePath = uri.fsPath;

                if (processedUris.has(filePath)) {
                    return;
                }

                processedUris.add(filePath);
                setTimeout(() => processedUris.delete(filePath), 500);

                await modelsProvider.refresh();
            };

            watcher.onDidCreate(autoRefreshHandler);
            watcher.onDidDelete(autoRefreshHandler);
            watcher.onDidChange(autoRefreshHandler);

            context.subscriptions.push(watcher);
        });

    }

    // Actualizar cuando cambia la configuración
    vscode.workspace.onDidChangeConfiguration(async e => {
        let needsRefresh = false;
        const config = vscode.workspace.getConfiguration('laravelModelsExplorer');

        if (e.affectsConfiguration('laravelModelsExplorer.autoRefresh') && config.get('autoRefresh', true)) {
            needsRefresh = true;
        }
        if (e.affectsConfiguration('laravelModelsExplorer.showProjectInfo')) {
            needsRefresh = true;
        }
        if (e.affectsConfiguration('laravelModelsExplorer.expandByDefault')) {
            needsRefresh = true;
        }
        if (e.affectsConfiguration('laravelModelsExplorer.enableTooltips')) {
            needsRefresh = true;
        }

        if (needsRefresh) {
            await modelsProvider.refresh();
        }
    });

    context.subscriptions.push(
        treeView,
        refreshCommand,
        openModelCommand,
        createModelCommand,
    );
}

async function createNewModel(modelName: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) { return; }

    const modelsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'app', 'Models');
    const modelFile = vscode.Uri.joinPath(modelsPath, `${modelName}.php`);

    try {
        await vscode.workspace.fs.writeFile(modelFile, Buffer.from(ModelTemplate(modelName)));
        await vscode.window.showTextDocument(modelFile);
        vscode.window.showInformationMessage(`Model ${modelName} created successfully`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error creating the model: ${error}`);
    }
}

export function deactivate() { }