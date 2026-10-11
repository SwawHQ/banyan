# Windows native process fixture; all installer behavior is tested in JavaScript.
$ErrorActionPreference = 'Stop'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/')
$work = [IO.Path]::GetFullPath((Join-Path $temporaryRoot ('banyan-toolchain-' + [guid]::NewGuid().ToString())))
[void][IO.Directory]::CreateDirectory($work)
$previous = $env:BANYAN_TEST_WORKSPACE
$previousNode = $env:BANYAN_SYSTEM_NODE
try {
    Add-Type -TypeDefinition ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'fixtures/tool-runtime.cs'))) -OutputAssembly (Join-Path $work 'fixture.exe') -OutputType ConsoleApplication
    $env:BANYAN_TEST_WORKSPACE = $work
    $env:BANYAN_SYSTEM_NODE = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
    & (Join-Path $repositoryRoot '.agents/skills/swaw-banyan/.tools/bun/bun.exe') test (Join-Path $PSScriptRoot 'toolchain.test.mjs') --timeout 15000
    $result = $LASTEXITCODE
} finally {
    $env:BANYAN_TEST_WORKSPACE = $previous
    $env:BANYAN_SYSTEM_NODE = $previousNode
    if ([IO.Path]::GetDirectoryName($work) -ne $temporaryRoot -or [IO.Path]::GetFileName($work) -notlike 'banyan-toolchain-*') {
        throw 'Unexpected test workspace; refusing cleanup'
    }
    Remove-Item -LiteralPath $work -Recurse -Force
}
exit $result
