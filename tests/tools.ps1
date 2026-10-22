# Windows native process fixture; all installer behavior is tested in JavaScript.
$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
$work = [IO.Path]::GetFullPath((Join-Path $temporaryRoot ('banyan-tools-' + [guid]::NewGuid().ToString())))
[void][IO.Directory]::CreateDirectory($work)
$previous = $env:BANYAN_TEST_WORKSPACE
$previousNode = $env:BANYAN_SYSTEM_NODE
try {
    Add-Type -TypeDefinition ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'fixtures/tool-runtime.cs'))) -OutputAssembly (Join-Path $work 'fixture.exe') -OutputType ConsoleApplication
    [IO.File]::WriteAllText((Join-Path $work 'forward-node.mjs'), @'
import {pathToFileURL} from 'node:url';
process.execPath = process.argv[2];
process.argv = process.argv.slice(2);
await import(pathToFileURL(process.argv[1]).href);
'@)
    $env:BANYAN_TEST_WORKSPACE = $work
    $env:BANYAN_SYSTEM_NODE = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
    & (Join-Path $repositoryRoot '.agents/skills/swaw-banyan/.tools/bun/bun.exe') test (Join-Path $PSScriptRoot 'tools.test.mjs') --timeout 15000 @args
    $result = $LASTEXITCODE
} finally {
    $env:BANYAN_TEST_WORKSPACE = $previous
    $env:BANYAN_SYSTEM_NODE = $previousNode
    if ([IO.Path]::GetDirectoryName($work) -ne $temporaryRoot -or [IO.Path]::GetFileName($work) -notlike 'banyan-tools-*') {
        throw 'Unexpected test workspace; refusing cleanup'
    }
    Remove-Item -LiteralPath $work -Recurse -Force
}
exit $result
