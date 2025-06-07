import * as vscode from 'vscode';
import { LaravelProjectDetector } from './laravelProjectDetector';



export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('laravel-detector.checkLaravelProject', async () => {
        const detector = new LaravelProjectDetector();
        const isLaravel = await detector.isLaravelProject();

        if (isLaravel) {
            vscode.window.showInformationMessage('es laravel');
        } else {
            vscode.window.showWarningMessage('no e laravel tigeron klk');
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}