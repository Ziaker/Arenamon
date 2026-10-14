# Configura wrapper para o Microsoft Edge em ambientes de CI headless para forcar software rasterizer (SwiftShader)
$edgeDir = "C:\Program Files (x86)\Microsoft\Edge\Application"
if (Test-Path "$edgeDir\msedge.exe") {
    if (-not (Test-Path "$edgeDir\msedge_orig.exe")) {
        Stop-Process -Name msedge -Force -ErrorAction SilentlyContinue
        Move-Item "$edgeDir\msedge.exe" "$edgeDir\msedge_orig.exe" -Force
        $code = @"
using System;
using System.Diagnostics;
class Program {
    static int Main(string[] args) {
        var psi = new ProcessStartInfo();
        psi.FileName = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge_orig.exe";
        psi.UseShellExecute = false;
        psi.Arguments = "--use-angle=swiftshader --disable-gpu-sandbox --no-sandbox";
        foreach (var a in args) {
            if (a.Contains(" ") || a.Contains("\"")) {
                psi.Arguments += " \"" + a.Replace("\"", "\\\"") + "\"";
            } else {
                psi.Arguments += " " + a;
            }
        }
        var p = Process.Start(psi);
        p.WaitForExit();
        return p.ExitCode;
    }
}
"@
        Add-Type -TypeDefinition $code -OutputAssembly "$edgeDir\msedge.exe" -OutputType ConsoleApplication
        Write-Host "Edge wrapper configured with SwiftShader"
    }
}
