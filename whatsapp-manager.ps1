Add-Type -Name Window -Namespace Console -MemberDefinition '
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("kernel32.dll")]
public static extern IntPtr GetConsoleWindow();
'
$consolePtr = [Console.Window]::GetConsoleWindow()
if ($consolePtr -ne [IntPtr]::Zero) {
    [Console.Window]::ShowWindow($consolePtr, 0)
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

function Invoke-HiddenCmd ($cmdStr) {
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = "cmd.exe"
    $pinfo.Arguments = "/c $cmdStr"
    $pinfo.CreateNoWindow = $true
    $pinfo.UseShellExecute = $false
    $pinfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $p = [System.Diagnostics.Process]::Start($pinfo)
    if ($p) {
        $p.WaitForExit()
        return $p.ExitCode
    }
    return -1
}

function Get-LocalIPAddress {
    try {
        $ipObj = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1
        if ($ipObj) { return $ipObj.IPAddress }
    } catch {}
    return "localhost"
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'إدارة خادم الواتساب - AN-Academy'
$form.Size = New-Object System.Drawing.Size(500, 640)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.RightToLeft = [System.Windows.Forms.RightToLeft]::Yes
$form.RightToLeftLayout = $true

$fontTitle = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
$fontButton = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)
$fontStatus = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'لوحة تحكم خادم الواتساب (المحلي والإنترنت)'
$title.Font = $fontTitle
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(60, 12)
$form.Controls.Add($title)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'الحالة: جاري الفحص...'
$statusLabel.Font = $fontStatus
$statusLabel.Size = New-Object System.Drawing.Size(440, 36)
$statusLabel.Location = New-Object System.Drawing.Point(25, 45)
$statusLabel.ForeColor = [System.Drawing.Color]::DarkBlue
$form.Controls.Add($statusLabel)

function Update-Status {
    $netstat = netstat -aon | Select-String ':3001' | Select-String 'LISTENING'
    if ($netstat) {
        $line = $netstat[0].Line.Trim()
        $tokens = -split $line
        $pidNum = $tokens[-1]
        $ip = Get-LocalIPAddress
        $statusLabel.Text = 'الحالة: يعمل في الخلفية (PID: ' + $pidNum + ')' + "`n" + 'عنوان الشبكة المحلية: http://' + $ip + ':3001'
        $statusLabel.ForeColor = [System.Drawing.Color]::DarkGreen
    } else {
        $statusLabel.Text = 'الحالة: الخادم متوقف حالياً (NOT RUNNING)'
        $statusLabel.ForeColor = [System.Drawing.Color]::DarkRed
    }
    Update-TunnelStatus
}

$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = '▶ 1. تشغيل خادم الواتساب (في الخلفية)'
$btnStart.Font = $fontButton
$btnStart.Size = New-Object System.Drawing.Size(435, 38)
$btnStart.Location = New-Object System.Drawing.Point(25, 88)
$btnStart.BackColor = [System.Drawing.Color]::FromArgb(46, 204, 113)
$btnStart.ForeColor = [System.Drawing.Color]::White
$btnStart.FlatStyle = 'Flat'
$btnStart.Add_Click({
    $netstat = netstat -aon | Select-String ':3001' | Select-String 'LISTENING'
    if ($netstat) {
        Update-Status
        [System.Windows.Forms.MessageBox]::Show('خادم الواتساب يعمل بالفعل!', 'تنبيه', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    } else {
        $statusLabel.Text = 'جاري تشغيل الخادم...'
        $statusLabel.ForeColor = [System.Drawing.Color]::DarkOrange
        $form.Refresh()

        $res = Invoke-HiddenCmd "node node_modules\pm2\bin\pm2 restart whatsapp-server >nul 2>&1"
        if ($res -ne 0) {
            $res = Invoke-HiddenCmd "node node_modules\pm2\bin\pm2 start start-whatsapp-server.js --name whatsapp-server >nul 2>&1"
        }
        if ($res -ne 0) {
            Invoke-HiddenCmd "wscript //Nologo start-whatsapp-background.vbs"
        }

        $isStarted = $false
        for ($i = 0; $i -lt 20; $i++) {
            Start-Sleep -Milliseconds 500
            $check = netstat -aon | Select-String ':3001' | Select-String 'LISTENING'
            if ($check) {
                $isStarted = $true
                break
            }
        }

        Update-Status
        $form.Refresh()

        if ($isStarted) {
            $ip = Get-LocalIPAddress
            [System.Windows.Forms.MessageBox]::Show('تم تشغيل خادم الواتساب بنجاح وهو يعمل الآن!' + "`n`n" + 'عنوان الشبكة المحلية:' + "`n" + 'http://' + $ip + ':3001', 'نجاح', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        } else {
            [System.Windows.Forms.MessageBox]::Show('تم إرسال أمر التشغيل، يرجى الفحص بعد لحظات من الخيار (2).', 'تنبيه', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
        }
    }
})
$form.Controls.Add($btnStart)

$btnStatus = New-Object System.Windows.Forms.Button
$btnStatus.Text = '🔍 2. معرفة حالة الخادم وعنوان الشبكة'
$btnStatus.Font = $fontButton
$btnStatus.Size = New-Object System.Drawing.Size(435, 38)
$btnStatus.Location = New-Object System.Drawing.Point(25, 132)
$btnStatus.BackColor = [System.Drawing.Color]::FromArgb(52, 152, 219)
$btnStatus.ForeColor = [System.Drawing.Color]::White
$btnStatus.FlatStyle = 'Flat'
$btnStatus.Add_Click({
    Update-Status
    [System.Windows.Forms.MessageBox]::Show($statusLabel.Text, 'حالة الخادم', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
})
$form.Controls.Add($btnStatus)

$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text = '⏹ 3. إيقاف خادم الواتساب'
$btnStop.Font = $fontButton
$btnStop.Size = New-Object System.Drawing.Size(435, 38)
$btnStop.Location = New-Object System.Drawing.Point(25, 176)
$btnStop.BackColor = [System.Drawing.Color]::FromArgb(231, 76, 60)
$btnStop.ForeColor = [System.Drawing.Color]::White
$btnStop.FlatStyle = 'Flat'
$btnStop.Add_Click({
    $statusLabel.Text = 'جاري إيقاف الخادم...'
    $statusLabel.ForeColor = [System.Drawing.Color]::DarkRed
    $form.Refresh()
    Invoke-HiddenCmd "node node_modules\pm2\bin\pm2 stop whatsapp-server >nul 2>&1 & node node_modules\pm2\bin\pm2 delete whatsapp-server >nul 2>&1"
    $netstat = netstat -aon | Select-String ':3001' | Select-String 'LISTENING'
    if ($netstat) {
        $line = $netstat[0].Line.Trim()
        $tokens = -split $line
        $pidNum = $tokens[-1]
        Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue
    }
    Update-Status
    $form.Refresh()
    [System.Windows.Forms.MessageBox]::Show('تم إيقاف خادم الواتساب بنجاح.', 'إيقاف السيرفر', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
})
$form.Controls.Add($btnStop)

$btnLogs = New-Object System.Windows.Forms.Button
$btnLogs.Text = '📜 4. عرض آخر السجلات (Logs)'
$btnLogs.Font = $fontButton
$btnLogs.Size = New-Object System.Drawing.Size(435, 38)
$btnLogs.Location = New-Object System.Drawing.Point(25, 220)
$btnLogs.BackColor = [System.Drawing.Color]::FromArgb(149, 165, 166)
$btnLogs.ForeColor = [System.Drawing.Color]::White
$btnLogs.FlatStyle = 'Flat'
$btnLogs.Add_Click({
    if (Test-Path 'whatsapp-server.log') {
        $logContent = Get-Content 'whatsapp-server.log' -Tail 25 | Out-String
        [System.Windows.Forms.MessageBox]::Show($logContent, 'آخر السجلات', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    } else {
        [System.Windows.Forms.MessageBox]::Show('لا يوجد ملف سجلات حالياً.', 'تنبيه', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
    }
})
$form.Controls.Add($btnLogs)

$btnFirewall = New-Object System.Windows.Forms.Button
$btnFirewall.Text = '🌐 5. السماح للمنفذ 3001 في جدار الحماية (Firewall)'
$btnFirewall.Font = $fontButton
$btnFirewall.Size = New-Object System.Drawing.Size(435, 38)
$btnFirewall.Location = New-Object System.Drawing.Point(25, 264)
$btnFirewall.BackColor = [System.Drawing.Color]::FromArgb(155, 89, 182)
$btnFirewall.ForeColor = [System.Drawing.Color]::White
$btnFirewall.FlatStyle = 'Flat'
$btnFirewall.Add_Click({
    Invoke-HiddenCmd "netsh advfirewall firewall add rule name=\"AN-Academy WhatsApp (3001)\" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1"
    [System.Windows.Forms.MessageBox]::Show('تم السماح للمنفذ 3001 عبر جدار حماية ويندوز بنجاح!' + "`n`n" + 'يمكن لباقي الأجهزة على الشبكة الآن استخدام خدمة الواتساب.', 'جدار الحماية', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
})
$form.Controls.Add($btnFirewall)

# --- GroupBox for Internet Tunnel ---
$grpTunnel = New-Object System.Windows.Forms.GroupBox
$grpTunnel.Text = ' 🌍 قسم رابط الإنترنت العام للمعلمين (Internet Tunnel) '
$grpTunnel.Font = $fontButton
$grpTunnel.Size = New-Object System.Drawing.Size(435, 230)
$grpTunnel.Location = New-Object System.Drawing.Point(25, 312)
$form.Controls.Add($grpTunnel)

$lblTunnelStatus = New-Object System.Windows.Forms.Label
$lblTunnelStatus.Text = 'رابط الإنترنت: متوقف حالياً'
$lblTunnelStatus.Font = $fontStatus
$lblTunnelStatus.Size = New-Object System.Drawing.Size(400, 24)
$lblTunnelStatus.Location = New-Object System.Drawing.Point(15, 25)
$lblTunnelStatus.ForeColor = [System.Drawing.Color]::DarkRed
$grpTunnel.Controls.Add($lblTunnelStatus)

$txtTunnelUrl = New-Object System.Windows.Forms.TextBox
$txtTunnelUrl.Text = 'اضغط على زر تشغيل الرابط لتوليد رابط إنترنت دائم...'
$txtTunnelUrl.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$txtTunnelUrl.Size = New-Object System.Drawing.Size(400, 26)
$txtTunnelUrl.Location = New-Object System.Drawing.Point(15, 52)
$txtTunnelUrl.ReadOnly = $true
$grpTunnel.Controls.Add($txtTunnelUrl)

function Update-TunnelStatus {
    if (Test-Path 'whatsapp-tunnel.url') {
        $url = (Get-Content 'whatsapp-tunnel.url' -Raw).Trim()
        if ($url -like "https://*") {
            $lblTunnelStatus.Text = 'رابط الإنترنت: يعمل بنجاح 🌐'
            $lblTunnelStatus.ForeColor = [System.Drawing.Color]::DarkGreen
            $txtTunnelUrl.Text = $url
            return
        }
    }
    $lblTunnelStatus.Text = 'رابط الإنترنت: متوقف حالياً'
    $lblTunnelStatus.ForeColor = [System.Drawing.Color]::DarkRed
    $txtTunnelUrl.Text = 'اضغط على زر تشغيل الرابط لتوليد رابط إنترنت آمن للمعلمين...'
}

$btnStartTunnel = New-Object System.Windows.Forms.Button
$btnStartTunnel.Text = '▶ 6. تشغيل رابط الإنترنت للمعلمين'
$btnStartTunnel.Font = $fontButton
$btnStartTunnel.Size = New-Object System.Drawing.Size(400, 36)
$btnStartTunnel.Location = New-Object System.Drawing.Point(15, 88)
$btnStartTunnel.BackColor = [System.Drawing.Color]::FromArgb(230, 126, 34)
$btnStartTunnel.ForeColor = [System.Drawing.Color]::White
$btnStartTunnel.FlatStyle = 'Flat'
$btnStartTunnel.Add_Click({
    $lblTunnelStatus.Text = 'جاري الاتصال بالنفق وتوليد رابط الإنترنت...'
    $lblTunnelStatus.ForeColor = [System.Drawing.Color]::DarkOrange
    $grpTunnel.Refresh()

    # Kill old tunnel process if any
    $pList = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*whatsapp-tunnel.js*" }
    foreach ($p in $pList) { Stop-Process -Id $p.Id -Force }

    Start-Process node -ArgumentList 'whatsapp-tunnel.js' -WorkingDirectory (Get-Location) -WindowStyle Hidden

    $hasUrl = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-Path 'whatsapp-tunnel.url') {
            $url = (Get-Content 'whatsapp-tunnel.url' -Raw).Trim()
            if ($url -like "https://*") {
                $hasUrl = $true
                break
            }
        }
    }

    Update-TunnelStatus
    if ($hasUrl) {
        [System.Windows.Forms.MessageBox]::Show('تم توليد رابط الإنترنت العام بنجاح!' + "`n`n" + 'الرابط الحالي:' + "`n" + $txtTunnelUrl.Text, 'نجاح رابط الإنترنت', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    } else {
        [System.Windows.Forms.MessageBox]::Show('جاري تشغيل رابط الإنترنت في الخلفية، اضغط فحص أو تحديث بعد لحظات.', 'تنبيه', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
    }
})
$grpTunnel.Controls.Add($btnStartTunnel)

$btnCopyUrl = New-Object System.Windows.Forms.Button
$btnCopyUrl.Text = '📋 نسخ الرابط'
$btnCopyUrl.Font = $fontButton
$btnCopyUrl.Size = New-Object System.Drawing.Size(195, 34)
$btnCopyUrl.Location = New-Object System.Drawing.Point(220, 132)
$btnCopyUrl.BackColor = [System.Drawing.Color]::FromArgb(41, 128, 185)
$btnCopyUrl.ForeColor = [System.Drawing.Color]::White
$btnCopyUrl.FlatStyle = 'Flat'
$btnCopyUrl.Add_Click({
    if ($txtTunnelUrl.Text -like "https://*") {
        [System.Windows.Forms.Clipboard]::SetText($txtTunnelUrl.Text)
        [System.Windows.Forms.MessageBox]::Show('تم نسخ رابط الإنترنت إلى الحافظة بنجاح!', 'تم النسخ', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    } else {
        [System.Windows.Forms.MessageBox]::Show('لا يوجد رابط إنترنت شغال حالياً لنسخه.', 'تنبيه', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
    }
})
$grpTunnel.Controls.Add($btnCopyUrl)

$btnStopTunnel = New-Object System.Windows.Forms.Button
$btnStopTunnel.Text = '⏹ إيقاف الرابط'
$btnStopTunnel.Font = $fontButton
$btnStopTunnel.Size = New-Object System.Drawing.Size(195, 34)
$btnStopTunnel.Location = New-Object System.Drawing.Point(15, 132)
$btnStopTunnel.BackColor = [System.Drawing.Color]::FromArgb(192, 57, 43)
$btnStopTunnel.ForeColor = [System.Drawing.Color]::White
$btnStopTunnel.FlatStyle = 'Flat'
$btnStopTunnel.Add_Click({
    $pList = Get-Process node -ErrorAction SilentlyContinue
    foreach ($p in $pList) {
        try {
            if ($p.CommandLine -like "*whatsapp-tunnel.js*") {
                Stop-Process -Id $p.Id -Force
            }
        } catch {}
    }
    if (Test-Path 'whatsapp-tunnel.url') {
        Remove-Item 'whatsapp-tunnel.url' -Force -ErrorAction SilentlyContinue
    }
    Update-TunnelStatus
    [System.Windows.Forms.MessageBox]::Show('تم إيقاف رابط الإنترنت بنجاح.', 'إيقاف النفق', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
})
$grpTunnel.Controls.Add($btnStopTunnel)

Update-Status
[void]$form.ShowDialog()
