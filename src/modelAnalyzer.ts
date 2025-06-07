import * as path from 'path';
import * as vscode from 'vscode';

export interface ModelInfo {
    name: string;
    namespace: string;
    table?: string;
    fillable: string[];
    hidden: string[];
    casts: { [key: string]: string };
    relationships: RelationshipInfo[];
    traits: string[];
}

export interface RelationshipInfo {
    name: string;
    type: string;
    relatedModel?: string;
}

export class ModelAnalyzer {
    async analyzeModel(fileUri: vscode.Uri): Promise<ModelInfo | null> {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();

            const modelName = this.extractModelName(fileUri);
            if (!modelName) { return null; }

            const info: ModelInfo = {
                name: modelName,
                namespace: this.extractNamespace(content),
                fillable: this.extractFillable(content),
                hidden: this.extractHidden(content),
                casts: this.extractCasts(content),
                relationships: this.extractRelationships(content),
                traits: this.extractTraits(content)
            };

            // Extraer nombre de tabla si está definido
            const customTable = this.extractTable(content);
            if (customTable) {
                info.table = customTable;
            } else {
                // Generar nombre de tabla por convención
                info.table = this.generateTableName(modelName);
            }

            return info;
        } catch (error) {
            console.error(`Error analyzing model ${fileUri.fsPath}:`, error);
            return null;
        }
    }

    private extractModelName(fileUri: vscode.Uri): string | null {
        const fileName = path.basename(fileUri.fsPath, '.php');
        // Verificar que sea un nombre de clase válido
        if (/^[A-Z][a-zA-Z0-9]*$/.test(fileName)) {
            return fileName;
        }
        return null;
    }

    private extractNamespace(content: string): string {
        const namespaceMatch = content.match(/namespace\s+([^;]+);/);
        return namespaceMatch ? namespaceMatch[1].trim() : 'App\\Models';
    }

    private extractFillable(content: string): string[] {
        const patterns = [
            /protected\s+\$fillable\s*=\s*\[(.*?)\];/s,
            /protected\s+\$fillable\s*=\s*\[(.*?)\]/s
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                return this.parseArrayValues(match[1]);
            }
        }
        return [];
    }

    private extractHidden(content: string): string[] {
        const patterns = [
            /protected\s+\$hidden\s*=\s*\[(.*?)\];/s,
            /protected\s+\$hidden\s*=\s*\[(.*?)\]/s
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                return this.parseArrayValues(match[1]);
            }
        }
        return [];
    }

    private extractCasts(content: string): { [key: string]: string } {
        const patterns = [
            /protected\s+\$casts\s*=\s*\[(.*?)\];/s,
            /protected\s+\$casts\s*=\s*\[(.*?)\]/s
        ];

        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
                return this.parseAssociativeArray(match[1]);
            }
        }
        return {};
    }

    private extractTable(content: string): string | null {
        const pattern = /protected\s+\$table\s*=\s*['"]([^'"]+)['"];/;
        const match = content.match(pattern);
        return match ? match[1] : null;
    }

    private extractRelationships(content: string): RelationshipInfo[] {
        const relationships: RelationshipInfo[] = [];
        const relationshipTypes = [
            'hasOne', 'hasMany', 'belongsTo', 'belongsToMany',
            'hasOneThrough', 'hasManyThrough', 'morphOne', 'morphMany',
            'morphTo', 'morphToMany'
        ];

        // Buscar métodos que retornen relaciones
        const methodPattern = /public\s+function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{[^}]*return\s+\$this->(\w+)\(/g;
        let match;

        while ((match = methodPattern.exec(content)) !== null) {
            const methodName = match[1];
            const relationType = match[2];

            if (relationshipTypes.includes(relationType)) {
                relationships.push({
                    name: methodName,
                    type: relationType
                });
            }
        }

        return relationships;
    }

    private extractTraits(content: string): string[] {
        const traits: string[] = [];
        const usePattern = /use\s+([^;{]+)[;{]/g;
        let match;

        while ((match = usePattern.exec(content)) !== null) {
            const traitList = match[1].trim();
            // Filtrar solo traits (no imports)
            if (!traitList.includes('\\') || traitList.includes('HasFactory')) {
                const traitNames = traitList.split(',').map(t => t.trim());
                traits.push(...traitNames);
            }
        }

        return traits;
    }

    private parseArrayValues(arrayContent: string): string[] {
        const values: string[] = [];
        const cleanContent = arrayContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

        // Buscar strings entre comillas
        const stringPattern = /['"]([^'"]+)['"]/g;
        let match;

        while ((match = stringPattern.exec(cleanContent)) !== null) {
            values.push(match[1]);
        }

        return values;
    }

    private parseAssociativeArray(arrayContent: string): { [key: string]: string } {
        const result: { [key: string]: string } = {};
        const cleanContent = arrayContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

        // Buscar pares key => value
        const pairPattern = /['"]([^'"]+)['"]\s*=>\s*['"]([^'"]+)['"]/g;
        let match;

        while ((match = pairPattern.exec(cleanContent)) !== null) {
            result[match[1]] = match[2];
        }

        return result;
    }

    private generateTableName(modelName: string): string {
        // Convertir CamelCase a snake_case y pluralizar
        const snakeCase = modelName.replace(/([A-Z])/g, '_$1').toLowerCase().substring(1);

        // Pluralización simple
        if (snakeCase.endsWith('y')) {
            return snakeCase.slice(0, -1) + 'ies';
        } else if (snakeCase.endsWith('s') || snakeCase.endsWith('sh') || snakeCase.endsWith('ch')) {
            return snakeCase + 'es';
        } else {
            return snakeCase + 's';
        }
    }
}