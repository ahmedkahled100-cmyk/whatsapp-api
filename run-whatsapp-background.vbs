Set WshShell = CreateObject("WScript.Shell")
strDir = CreateObject("Scripting.FileSystemObject").GetAbsolutePathName(".")
WshShell.CurrentDirectory = strDir
WshShell.Run "cmd /c ""node start-whatsapp-server.js > whatsapp-server.log 2>&1""", 0, False
