param(
    [ValidateSet('read','check','write','remove')][string]$Action,
    [Parameter(Mandatory=$true)][string]$Target
)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
try {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
public static class SwbanCredential {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct Credential {
        public uint Flags, Type;
        public string TargetName, Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist, AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias, UserName;
    }
    public sealed class Record { public string UserName, Secret; }
    [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool ReadNative(string target, uint type, uint flags, out IntPtr credential);
    [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool WriteNative(ref Credential credential, uint flags);
    [DllImport("advapi32.dll", EntryPoint="CredDeleteW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool DeleteNative(string target, uint type, uint flags);
    [DllImport("advapi32.dll")] static extern void CredFree(IntPtr credential);
    public static Record Read(string target, bool secret) {
        IntPtr pointer;
        if (!ReadNative(target, 1, 0, out pointer)) {
            int code = Marshal.GetLastWin32Error();
            if (code == 1168) return null;
            throw new Win32Exception(code);
        }
        try {
            Credential value = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
            if (value.CredentialBlobSize > 2560 || value.CredentialBlobSize % 2 != 0) throw new InvalidOperationException();
            return new Record { UserName=value.UserName, Secret=secret ? Marshal.PtrToStringUni(value.CredentialBlob, (int)value.CredentialBlobSize / 2) : null };
        } finally { CredFree(pointer); }
    }
    public static void Write(string target, string userName, string token) {
        byte[] bytes = Encoding.Unicode.GetBytes(token);
        if (bytes.Length == 0 || bytes.Length > 2560) throw new InvalidOperationException();
        IntPtr pointer = Marshal.AllocHGlobal(bytes.Length);
        try {
            Marshal.Copy(bytes, 0, pointer, bytes.Length);
            Credential value = new Credential { Type=1, TargetName=target, UserName=userName,
                CredentialBlobSize=(uint)bytes.Length, CredentialBlob=pointer, Persist=2 };
            if (!WriteNative(ref value, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
        } finally {
            Array.Clear(bytes, 0, bytes.Length);
            for (int index=0; index<bytes.Length; index++) Marshal.WriteByte(pointer, index, 0);
            Marshal.FreeHGlobal(pointer);
        }
    }
    public static void Remove(string target) {
        if (!DeleteNative(target, 1, 0) && Marshal.GetLastWin32Error() != 1168) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
}
'@
    if ($Action -eq 'write') {
        $record = [Console]::In.ReadToEnd() | ConvertFrom-Json
        [SwbanCredential]::Write($Target, [string]$record.userName, [string]$record.secret)
        [Console]::WriteLine('{"saved":true}')
    } elseif ($Action -eq 'remove') {
        [SwbanCredential]::Remove($Target)
        [Console]::WriteLine('{"removed":true}')
    } else {
        $record = [SwbanCredential]::Read($Target, $Action -eq 'read')
        if ($null -eq $record) { [Console]::WriteLine('null') }
        else {
            $output = @{userName=$record.UserName}
            if ($Action -eq 'read') { $output.secret = $record.Secret }
            [Console]::WriteLine(($output | ConvertTo-Json -Compress))
        }
    }
} catch {
    # Never include input, secrets or exception text in output.
    [Console]::Error.WriteLine('credential_store_failed')
    exit 1
}
