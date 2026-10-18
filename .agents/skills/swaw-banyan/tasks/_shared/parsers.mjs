import {loadDependency} from './dependencies.mjs';

export const parseYaml = text => loadDependency('yaml').parse(text);
export const parseToml = text => loadDependency('@iarna/toml').parse(text);
