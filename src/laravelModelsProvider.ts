import * as vscode from 'vscode';
import { ModelAnalyzer } from './modelAnalyzer';

export class LaravelModelsProvider implements vscode.TreeDataProvider<ModelItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ModelItem | undefined | null | void> = new vscode.EventEmitter<ModelItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ModelItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private models: ModelItem[] = [];
    private analyzer: ModelAnalyzer;

    constructor() {
        this.analyzer = new ModelAnalyzer();
        this.refresh();
    }

    refresh(): void {
        this.loadModels();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ModelItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ModelItem): Thenable<ModelItem[]> {
        if (!element) {
            return Promise.resolve(this.models);
        }
        return Promise.resolve(element.children || []);
    }

    private async loadModels() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this.models = [];
            return;
        }

        try {
            const modelsPattern = new vscode.RelativePattern(workspaceFolder, 'app/Models/**/*.php');
            const files = await vscode.workspace.findFiles(modelsPattern);

            this.models = [];

            for (const file of files) {
                const modelInfo = await this.analyzer.analyzeModel(file);
                if (modelInfo) {
                    const modelItem = new ModelItem(
                        modelInfo.name,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        file
                    );

                    // Agregar información como hijos
                    modelItem.children = this.createModelInfoNodes(modelInfo);
                    modelItem.tooltip = this.createTooltip(modelInfo);

                    this.models.push(modelItem);
                }
            }

            // Ordenar modelos alfabéticamente
            this.models.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));

        } catch (error) {
            console.error('Error loading models:', error);
            this.models = [];
        }
    }

    private createModelInfoNodes(modelInfo: any): ModelItem[] {
        const children: ModelItem[] = [];

        // Propiedades fillable
        if (modelInfo.fillable && modelInfo.fillable.length > 0) {
            const fillableNode = new ModelItem(
                `Fillable (${modelInfo.fillable.length})`,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            fillableNode.iconPath = new vscode.ThemeIcon('edit');
            fillableNode.children = modelInfo.fillable.map((field: string) =>
                new ModelItem(field, vscode.TreeItemCollapsibleState.None)
            );
            children.push(fillableNode);
        }

        // Propiedades hidden
        if (modelInfo.hidden && modelInfo.hidden.length > 0) {
            const hiddenNode = new ModelItem(
                `Hidden (${modelInfo.hidden.length})`,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            hiddenNode.iconPath = new vscode.ThemeIcon('eye-closed');
            hiddenNode.children = modelInfo.hidden.map((field: string) =>
                new ModelItem(field, vscode.TreeItemCollapsibleState.None)
            );
            children.push(hiddenNode);
        }

        // Casts
        if (modelInfo.casts && Object.keys(modelInfo.casts).length > 0) {
            const castsNode = new ModelItem(
                `Casts (${Object.keys(modelInfo.casts).length})`,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            castsNode.iconPath = new vscode.ThemeIcon('symbol-property');
            castsNode.children = Object.entries(modelInfo.casts).map(([field, type]) =>
                new ModelItem(`${field}: ${type}`, vscode.TreeItemCollapsibleState.None)
            );
            children.push(castsNode);
        }

        // Relaciones
        if (modelInfo.relationships && modelInfo.relationships.length > 0) {
            const relationshipsNode = new ModelItem(
                `Relationships (${modelInfo.relationships.length})`,
                vscode.TreeItemCollapsibleState.Collapsed
            );
            relationshipsNode.iconPath = new vscode.ThemeIcon('references');
            relationshipsNode.children = modelInfo.relationships.map((rel: any) =>
                new ModelItem(`${rel.name} (${rel.type})`, vscode.TreeItemCollapsibleState.None)
            );
            children.push(relationshipsNode);
        }

        // Tabla
        if (modelInfo.table) {
            const tableNode = new ModelItem(
                `Table: ${modelInfo.table}`,
                vscode.TreeItemCollapsibleState.None
            );
            tableNode.iconPath = new vscode.ThemeIcon('database');
            children.push(tableNode);
        }

        return children;
    }

    private createTooltip(modelInfo: any): string {
        let tooltip = `Model: ${modelInfo.name}\n`;
        if (modelInfo.table) {
            tooltip += `Table: ${modelInfo.table}\n`;
        }
        if (modelInfo.fillable && modelInfo.fillable.length > 0) {
            tooltip += `Fillable: ${modelInfo.fillable.length} fields\n`;
        }
        if (modelInfo.relationships && modelInfo.relationships.length > 0) {
            tooltip += `Relationships: ${modelInfo.relationships.length}`;
        }
        return tooltip;
    }
}

export class ModelItem extends vscode.TreeItem {
    children: ModelItem[] | undefined;

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri?: vscode.Uri
    ) {
        super(label, collapsibleState);

        if (resourceUri) {
            this.tooltip = `${this.label} - ${resourceUri.fsPath}`;
            this.command = {
                command: 'laravelModels.openModel',
                title: 'Open Model',
                arguments: [this]
            };
            this.iconPath = new vscode.ThemeIcon('symbol-class');
            this.contextValue = 'model';
        }
    }
}