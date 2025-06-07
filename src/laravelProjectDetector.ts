import * as vscode from 'vscode';

export class LaravelProjectDetector {
    async isLaravelProject(): Promise<boolean> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return false;
        }

        try {
            // Verificar composer.json
            const composerJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'composer.json');
            const composerExists = await this.fileExists(composerJsonUri);

            if (!composerExists) {
                return false;
            }

            // Leer composer.json y verificar dependencias de Laravel
            const composerDocument = await vscode.workspace.openTextDocument(composerJsonUri);
            const composerContent = composerDocument.getText();

            try {
                const composerJson = JSON.parse(composerContent);
                const dependencies = {
                    ...composerJson.require,
                    ...composerJson['require-dev']
                };

                // Verificar si tiene Laravel/framework
                if (dependencies['laravel/framework']) {
                    return true;
                }

                // Verificar si tiene illuminate packages
                const illuminatePackages = Object.keys(dependencies).some(dep =>
                    dep.startsWith('illuminate/')
                );

                if (illuminatePackages) {
                    return true;
                }

            } catch (error) {
                console.log('Error parsing composer.json:', error);
            }

            // Verificar estructura de carpetas típica de Laravel
            const laravelDirectories = [
                'app/Http',
                'app/Models',
                'config',
                'database',
                'routes'
            ];

            let directoriesFound = 0;
            for (const dir of laravelDirectories) {
                const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, dir);
                if (await this.directoryExists(dirUri)) {
                    directoriesFound++;
                }
            }

            // Si encontramos al menos 3 de las 5 carpetas típicas, es probablemente Laravel
            if (directoriesFound >= 3) {
                return true;
            }

            // Verificar archivos específicos de Laravel
            const laravelFiles = [
                'artisan',
                'server.php',
                '.env.example'
            ];

            for (const file of laravelFiles) {
                const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, file);
                if (await this.fileExists(fileUri)) {
                    return true;
                }
            }

            return false;

        } catch (error) {
            console.error('Error detecting Laravel project:', error);
            return false;
        }
    }

    private async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    private async directoryExists(uri: vscode.Uri): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            return stat.type === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }
}

export interface LaravelProjectInfo {
    rootPath: string;
    version: string | null;
    modelsPath: vscode.Uri | null;
}