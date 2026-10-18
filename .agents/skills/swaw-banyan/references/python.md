# Python tools

```text
swban base/uv/ensure                    #Prepare uv
swban base/python/ensure                #Prepare Python 3.13
swban base/python --version             #Show the Python version
swban base/python script.py             #Run a Python script
swban base/uv pip install <package>     #Add a package to the Skill environment
swban base/uv tool run tccli --version  #Run TCCLI in its own tool environment
swban base/uv/check                     #Check the selected uv
swban base/python/check                 #Check the Python environment
```

uv uses the existing tool selection rules: keep the selected binding, reuse
a compatible PATH executable, or download the pinned portable archive with
SHA-256 verification. `base/uv/ensure --force` selects the portable copy.
The parent process and saved system PATH are unchanged.

Python installations, virtual environments, CLI packages and caches stay in
the Skill's `.tools/` directory. Python is managed by uv, with no registry
registration or global command installation. `base/python` and `base/uv pip`
share `.tools/python-env`. `base/uv run` uses that environment without a project.
`base/uv tool run` gives each CLI its own dependencies.

The wrapper removes inherited uv/Python settings and disables uv configuration,
project and dotenv discovery. A repository's `pyproject.toml`, `uv.toml`,
`uv.lock`, `.python-version` and `.venv` can coexist with this environment.
Relative arguments still use the caller's working directory. Explicit native
arguments can select other paths or projects.

Platform tasks must set their CLI credential and configuration locations
separately. When adding a platform, pin its CLI package version in that task.
Runtime isolation does not change cloud permissions.

Python environments contain absolute paths. After moving the Skill, remove
only its `.tools/python-env` and recreate it with `base/python/ensure`.

References: [uv tools](https://docs.astral.sh/uv/concepts/tools/),
[uv environment variables](https://docs.astral.sh/uv/reference/environment/),
[TCCLI installation](https://cloud.tencent.com/document/product/440/34011).
