Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' sync-agent klasörünü bul
agentDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Komutu arka planda (penceresiz - 0) çalıştır
cmd = "cmd /c cd /d """ & agentDir & """ && python agent.py"
WshShell.Run cmd, 0, False

Set WshShell = Nothing
Set fso = Nothing
