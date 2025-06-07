import * as vscode from 'vscode';
import { LaravelModelsProvider, ModelItem } from './laravelModelsProvider';
import { LaravelProjectDetector } from './laravelProjectDetector';

let modelsProvider: LaravelModelsProvider;

export function activate(context: vscode.ExtensionContext) {
    const detector = new LaravelProjectDetector();
    
    // Detectar si es un proyecto Laravel
    detector.isLaravelProject().then(isLaravel => {
        if (isLaravel) {
            vscode.commands.executeCommand('setContext', 'laravelProject', true);
            
            // Inicializar el proveedor de modelos
            modelsProvider = new LaravelModelsProvider();
            
            // Registrar el tree view
            const treeView = vscode.window.createTreeView('laravelModels', {
                treeDataProvider: modelsProvider,
                showCollapseAll: true
            });
            
            // Registrar comandos
            const refreshCommand = vscode.commands.registerCommand('laravelModels.refresh', () => {
                modelsProvider.refresh();
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
                    modelsProvider.refresh();
                }
            });
            
            // Auto-refresh cuando se modifican archivos
            const watcher = vscode.workspace.createFileSystemWatcher('**/app/Models/**/*.php');
            watcher.onDidCreate(() => modelsProvider.refresh());
            watcher.onDidDelete(() => modelsProvider.refresh());
            watcher.onDidChange(() => modelsProvider.refresh());
            
            context.subscriptions.push(
                treeView,
                refreshCommand,
                openModelCommand,
                createModelCommand,
                watcher
            );
        }
    });
}

async function createNewModel(modelName: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {return;}
    
    const modelsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'app', 'Models');
    const modelFile = vscode.Uri.joinPath(modelsPath, `${modelName}.php`);
    
    const modelTemplate = `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;

class ${modelName} extends Model
{
    use HasFactory;

    protected $fillable = [
        //
    ];

    protected $hidden = [
        //
    ];

    protected $casts = [
        //
    ];
}
`;
    
    try {
        await vscode.workspace.fs.writeFile(modelFile, Buffer.from(modelTemplate));
        await vscode.window.showTextDocument(modelFile);
        vscode.window.showInformationMessage(`Model ${modelName} created successfully`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error creating the model: ${error}`);
    }
}

export function deactivate() {}