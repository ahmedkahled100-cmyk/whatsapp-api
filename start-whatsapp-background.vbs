Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetAbsolutePathName(".")
WshShell.CurrentDirectory = strDir

WshShell.Run "cmd /c ""node start-whatsapp-server.js > whatsapp-server.log 2>&1""", 0, False
