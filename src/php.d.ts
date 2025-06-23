interface MyPHPScripts {
[key: string]: string;
}

declare module "virtual:php-scripts" {
const scripts: MyPHPScripts;
export const get_models: string;
export const helpers: string;
export default scripts;
}