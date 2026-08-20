Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Proje ana dizinini bul
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

' Komutu arka planda (penceresiz - 0) çalıştır
cmd = "cmd /c cd /d """ & projectDir & """ && python run.py --port 8765"
WshShell.Run cmd, 0, False

Set WshShell = Nothing
Set fso = Nothing
