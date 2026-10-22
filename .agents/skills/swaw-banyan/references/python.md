# Python tools

Run scripts and Python CLI packages directly. The Skill prepares uv, Python
and CLI dependencies as needed; no separate `ensure` command is required first.

```text
swban base/uv tool run tccli --version  #Run TCCLI in its own tool environment
swban base/uv run python script.py      #Run a script in the shared environment
swban base/uv/python --version          #Show the Python version
swban base/uv/python script.py          #Run a Python script
swban base/uv pip install <package>     #Add a package to the Skill environment
swban base/uv/check                     #Check the selected uv
swban base/uv/python/check              #Check the Python environment
```

uv uses the existing tool selection rules: keep the selected binding, reuse
a compatible PATH executable, or download the pinned portable archive with
SHA-256 verification. `base/uv/ensure --force` selects the portable copy.
The parent process and saved system PATH are unchanged.

Python installations, virtual environments, CLI packages and caches stay in
the Skill's `.tools/` directory. Python is managed by uv, with no registry
registration or global command installation. `base/uv/python` and `base/uv pip`
share `.tools/python-env`. `base/uv run` uses that environment without a project.
`base/uv tool run` gives each CLI its own dependencies.
`base/uv/python` runs Python; `base/uv python ...` uses uv's native Python
management commands.

`base/uv/ensure` prepares uv itself. To prepare the shared Python 3.13 script
environment in advance, use `base/uv/python/ensure`.

The wrapper removes inherited uv/Python settings and disables uv configuration,
project and dotenv discovery. A repository's `pyproject.toml`, `uv.toml`,
`uv.lock`, `.python-version` and `.venv` can coexist with this environment.
Global uv options may precede the command. Relative arguments still use the caller's
working directory. Explicit native
arguments can select other paths or projects.

Platform tasks must set their CLI credential and configuration locations
separately. When adding a platform, pin its CLI package version in that task.
Runtime isolation does not change cloud permissions.
Use [Tencent Cloud tools](tencent.md) for the pinned tccli entry and local checks.

Python environments contain absolute paths. After moving the Skill, remove
only its `.tools/python-env` and recreate it with `base/uv/python/ensure`.

References: [uv tools](https://docs.astral.sh/uv/concepts/tools/),
[uv environment variables](https://docs.astral.sh/uv/reference/environment/),
[TCCLI installation](https://cloud.tencent.com/document/product/440/34011).
