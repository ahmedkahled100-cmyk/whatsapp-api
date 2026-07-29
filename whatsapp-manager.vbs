Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetAbsolutePathName(".")
WshShell.CurrentDirectory = strDir
WshShell.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strDir & "\whatsapp-manager.ps1""", 0, False
