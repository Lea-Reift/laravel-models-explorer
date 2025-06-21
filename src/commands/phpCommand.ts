import { BaseCommand, Command, CommandOptions, defaultOptions } from "./baseCommand";
import { get_models } from "virtual:php-scripts";
import path from "path";
import { ModelInfo } from "../laravelModelsProvider";

export type CommandModelInfo = ModelInfo & {
    uri: string
};

export class PHPCommand extends BaseCommand {
    public static async getModels(workspaceFolder: string): Promise<CommandModelInfo[]> {
        if (!workspaceFolder.length) {
            return Promise.resolve([]);
        }

        const command: Command = {
            program: 'php',
            args: [
                get_models,
                path.normalize(workspaceFolder),
            ]
        };

        return this.execCommand(command, { ...defaultOptions, outputAsJSEntity: true });
    }
}