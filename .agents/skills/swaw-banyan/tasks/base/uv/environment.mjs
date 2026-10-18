import path from 'node:path';
import {toolsRoot} from '../../_shared/tools/manifest.mjs';

export const pythonVersion = '3.13';
export const pythonHome = (root = toolsRoot) => path.join(root, 'python-env');
export const pythonExecutable = (root = toolsRoot) => path.join(pythonHome(root), 'Scripts/python.exe');

export function uvEnvironment(env = process.env, root = toolsRoot) {
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) =>
    !/^(UV_|PYTHON|PIP_|VIRTUAL_ENV(?:_PROMPT)?$|CONDA_PREFIX(?:_\d+)?$|CONDA_DEFAULT_ENV$|__PYVENV_LAUNCHER__$)/i.test(key)));
  return {...clean,
    UV_NO_CONFIG:'1', UV_NO_PROJECT:'1', UV_NO_ENV_FILE:'1', UV_MANAGED_PYTHON:'1', UV_PYTHON:pythonVersion,
    UV_CACHE_DIR:path.join(root, '.cache/uv'), UV_PYTHON_CACHE_DIR:path.join(root, '.cache/uv/python'),
    UV_PYTHON_INSTALL_DIR:path.join(root, 'python'), UV_PYTHON_BIN_DIR:path.join(root, 'python-bin'),
    UV_PYTHON_INSTALL_BIN:'0', UV_PYTHON_INSTALL_REGISTRY:'0',
    UV_TOOL_DIR:path.join(root, 'python-tools'), UV_TOOL_BIN_DIR:path.join(root, 'python-tools/bin'),
    UV_PROJECT_ENVIRONMENT:pythonHome(root), VIRTUAL_ENV:pythonHome(root),
    PYTHONNOUSERSITE:'1', PYTHONSAFEPATH:'1', PYTHONDONTWRITEBYTECODE:'1', PYTHONUTF8:'1'
  };
}
