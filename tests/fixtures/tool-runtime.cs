using System;
using System.IO;
using System.Diagnostics;
using System.Text;
using System.Threading;
public static class BanyanFixtureRuntime {
    static string Encode(string value) { return Convert.ToBase64String(Encoding.UTF8.GetBytes(value)); }
    static string Quote(string value) {
        var result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char ch in value) {
            if (ch == '\\') { slashes++; continue; }
            result.Append('\\', ch == '"' ? slashes * 2 + 1 : slashes);
            result.Append(ch); slashes = 0;
        }
        return result.Append('\\', slashes * 2).Append('"').ToString();
    }
    public static int Main(string[] args) {
        Console.InputEncoding = new UTF8Encoding(false);
        string name = Path.GetFileNameWithoutExtension(Environment.GetCommandLineArgs()[0]);
        string directory = Path.GetDirectoryName(Environment.GetCommandLineArgs()[0]);
        string versionFile = Path.Combine(directory, "version-output");
        if (args.Length > 0 && args[0].EndsWith(".mjs")) {
            var forwarded = new StringBuilder(Quote(Path.Combine(Environment.GetEnvironmentVariable("BANYAN_TEST_WORKSPACE"), "forward-node.mjs")));
            forwarded.Append(" ").Append(Quote(Environment.GetCommandLineArgs()[0]));
            foreach (string arg in args) forwarded.Append(" ").Append(Quote(arg));
            var info = new ProcessStartInfo(Environment.GetEnvironmentVariable("BANYAN_SYSTEM_NODE"), forwarded.ToString());
            info.UseShellExecute = false; info.CreateNoWindow = true;
            info.RedirectStandardInput = true; info.RedirectStandardOutput = true; info.RedirectStandardError = true;
            using (var child = Process.Start(info)) {
                var output = child.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());
                var error = child.StandardError.BaseStream.CopyToAsync(Console.OpenStandardError());
                Console.OpenStandardInput().CopyTo(child.StandardInput.BaseStream); child.StandardInput.BaseStream.Close();
                child.WaitForExit();
                output.GetAwaiter().GetResult(); error.GetAwaiter().GetResult();
                return child.ExitCode;
            }
        }
        if (args.Length == 1 && args[0] == "--version") {
            Console.WriteLine(File.Exists(versionFile) ? File.ReadAllText(versionFile) : name == "git" ? "git version 2.56.0.windows.2" : name == "gh" ? "gh version 2.98.0 (2026-08-20)\nhttps://github.com/cli/cli/releases/tag/v2.98.0" : name == "node" ? "v24.20.0" : "1.4.2"); return 0;
        }
        if (args.Length == 1 && args[0] == "version") {
            bool plain = File.Exists(Path.Combine(Path.GetDirectoryName(Environment.GetCommandLineArgs()[0]), "plain-version"));
            Console.WriteLine(File.Exists(versionFile) ? File.ReadAllText(versionFile) : name == "go" ? "go version go1.27.1 windows/amd64" : plain ? "hugo v0.168.0 windows/amd64" : "hugo v0.168.0+extended windows/amd64"); return 0;
        }
        if (name == "go" && args.Length == 2 && args[0] == "env" && args[1] == "GOROOT") {
            Console.WriteLine(Path.GetDirectoryName(directory)); return 0;
        }
        if (Array.IndexOf(args, "--probe") >= 0) {
            Console.WriteLine("cwd:" + Encode(Environment.CurrentDirectory));
            Console.WriteLine("path:" + Encode(Environment.GetEnvironmentVariable("PATH")));
            if (name == "go" || name == "hugo") {
                Console.WriteLine("goroot:" + Encode(Environment.GetEnvironmentVariable("GOROOT") ?? ""));
                Console.WriteLine("toolchain:" + Encode(Environment.GetEnvironmentVariable("GOTOOLCHAIN") ?? ""));
                Console.WriteLine("gitexec:" + Encode(Environment.GetEnvironmentVariable("GIT_EXEC_PATH") ?? ""));
                foreach (string key in new string[] {"REVISION", "COMMIT_SHORT", "COMMIT_HREF", "THEME_REVISION", "THEME_DIRTY"})
                    Console.WriteLine(key + ":" + Encode(Environment.GetEnvironmentVariable("HUGO_PARAMS_BUILD_" + key) ?? ""));
            }
            if (name == "gh") {
                Console.WriteLine("gitexec:" + Encode(Environment.GetEnvironmentVariable("GIT_EXEC_PATH") ?? ""));
                Console.WriteLine("ghconfig:" + Encode(Environment.GetEnvironmentVariable("GH_CONFIG_DIR") ?? ""));
                Console.WriteLine("token:" + Encode(Environment.GetEnvironmentVariable("GH_TOKEN") == "fixture-token" ? "preserved" : "changed"));
            }
            foreach (string arg in args) if (arg != "--probe") Console.WriteLine("arg:" + Encode(arg));
            Console.WriteLine("input:" + Encode(Console.In.ReadToEnd()));
            Console.Error.Write("stderr-from-runtime"); return 17;
        }
        if (args.Length == 1 && args[0] == "--wait") { Thread.Sleep(6500); Console.WriteLine("finished"); return 0; }
        if (args.Length > 0 && args[0].EndsWith("-cli.js")) {
            foreach (string arg in args) Console.WriteLine(arg);
            return 23;
        }
        return 90;
    }
}
