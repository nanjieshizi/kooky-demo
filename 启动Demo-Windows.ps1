$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dist = Join-Path $root 'dist'
$port = 3000

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
  Write-Host '找不到 Demo 文件，请确认 runtime 文件夹完整。'
  Read-Host '按回车退出'
  exit 1
}

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg' = 'image/svg+xml'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.woff' = 'font/woff'
  '.woff2' = 'font/woff2'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)

try {
  $listener.Start()
  Start-Process "http://localhost:$port/super-assistant/"
  Write-Host "Kooky Demo 已启动：http://localhost:$port/super-assistant/"
  Write-Host '保持此窗口打开；关闭窗口即可停止 Demo 服务。'

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      while ($null -ne ($line = $reader.ReadLine()) -and $line -ne '') { }

      $requestParts = if ($requestLine) { $requestLine.Split(' ') } else { @() }
      if ($requestParts.Count -lt 2 -or $requestParts[0] -ne 'GET') {
        $body = [Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
        $header = "HTTP/1.1 405 Method Not Allowed`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      } else {
        $requestPath = [Uri]::UnescapeDataString($requestParts[1].Split([char]'?')[0])
        if ($requestPath -eq '/super-assistant' -or $requestPath -eq '/super-assistant/') {
          $relative = 'index.html'
        } elseif ($requestPath.StartsWith('/super-assistant/')) {
          $relative = $requestPath.Substring('/super-assistant/'.Length)
        } else {
          $relative = $requestPath.TrimStart('/')
          if ([String]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
        }

        $file = [IO.Path]::GetFullPath((Join-Path $dist $relative))
        $distRoot = [IO.Path]::GetFullPath($dist)
        if (-not $file.StartsWith($distRoot, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $file -PathType Leaf)) {
          $file = Join-Path $dist 'index.html'
        }

        $body = [IO.File]::ReadAllBytes($file)
        $extension = [IO.Path]::GetExtension($file).ToLowerInvariant()
        $contentType = if ($types.ContainsKey($extension)) { $types[$extension] } else { 'application/octet-stream' }
        $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
      }

      $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $stream.Flush()
    } catch {
      Write-Host "请求处理失败：$($_.Exception.Message)"
    } finally {
      if ($null -ne $client) { $client.Close() }
    }
  }
} catch {
  Write-Host "启动失败：$($_.Exception.Message)"
  Write-Host '请确认 3000 端口没有被其他程序占用。'
  Read-Host '按回车退出'
  exit 1
} finally {
  $listener.Stop()
}
