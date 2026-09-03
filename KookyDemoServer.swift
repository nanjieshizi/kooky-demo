import Foundation
import Darwin

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let port: UInt16 = 3000

func mimeType(for path: String) -> String {
    switch URL(fileURLWithPath: path).pathExtension.lowercased() {
    case "html": return "text/html; charset=utf-8"
    case "js": return "text/javascript; charset=utf-8"
    case "css": return "text/css; charset=utf-8"
    case "json": return "application/json; charset=utf-8"
    case "svg": return "image/svg+xml"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "webp": return "image/webp"
    case "woff", "woff2": return "font/woff2"
    default: return "application/octet-stream"
    }
}

func response(status: String, type: String, body: Data) -> Data {
    let header = "HTTP/1.1 \(status)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n"
    return Data(header.utf8) + body
}

func handle(_ client: Int32) {
    defer { close(client) }
    var buffer = [UInt8](repeating: 0, count: 8192)
    let count = recv(client, &buffer, buffer.count, 0)
    guard count > 0, let request = String(bytes: buffer[..<count], encoding: .utf8) else { return }
    let firstLine = request.split(separator: "\r\n", maxSplits: 1).first ?? ""
    let parts = firstLine.split(separator: " ")
    guard parts.count >= 2, parts[0] == "GET" else {
        let body = Data("Method Not Allowed".utf8)
        let packet = response(status: "405 Method Not Allowed", type: "text/plain", body: body)
        packet.withUnsafeBytes { raw in
            _ = send(client, raw.baseAddress, packet.count, 0)
        }
        return
    }
    let rawPath = String(parts[1].split(separator: "?", maxSplits: 1).first ?? "/")
    let decodedPath = rawPath.removingPercentEncoding ?? "/"
    let cleanPath: String
    if decodedPath == "/super-assistant" {
        cleanPath = "/"
    } else if decodedPath.hasPrefix("/super-assistant/") {
        cleanPath = String(decodedPath.dropFirst("/super-assistant".count))
    } else {
        cleanPath = decodedPath
    }
    let relative = cleanPath == "/" ? "index.html" : String(cleanPath.drop(while: { $0 == "/" }))
    let candidate = root.appendingPathComponent("dist").appendingPathComponent(relative)
    let fileURL = candidate.standardizedFileURL
    let distURL = root.appendingPathComponent("dist").standardizedFileURL
    let body: Data
    let path: String
    if fileURL.path.hasPrefix(distURL.path + "/"), let data = try? Data(contentsOf: fileURL) {
        body = data
        path = fileURL.path
    } else if let data = try? Data(contentsOf: distURL.appendingPathComponent("index.html")) {
        body = data
        path = "index.html"
    } else {
        body = Data("Demo files not found".utf8)
        path = ""
    }
    let status = path.isEmpty ? "404 Not Found" : "200 OK"
    let packet = response(status: status, type: mimeType(for: path), body: body)
    packet.withUnsafeBytes { raw in
        _ = send(client, raw.baseAddress, packet.count, 0)
    }
}

let server = socket(AF_INET, SOCK_STREAM, 0)
guard server >= 0 else { fatalError("Unable to create server socket") }
var reuse: Int32 = 1
setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))
var address = sockaddr_in()
address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
address.sin_family = sa_family_t(AF_INET)
address.sin_port = port.bigEndian
address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
let bindResult = withUnsafePointer(to: &address) { pointer in
    pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(server, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) }
}
guard bindResult == 0 else { fatalError("Unable to bind to port \(port)") }
guard listen(server, 16) == 0 else { fatalError("Unable to listen on port \(port)") }

print("Kooky Demo: http://localhost:\(port)/super-assistant/")
let browser = Process()
browser.executableURL = URL(fileURLWithPath: "/usr/bin/open")
browser.arguments = ["http://localhost:\(port)/super-assistant/"]
try? browser.run()

while true {
    var clientAddress = sockaddr_in()
    var length = socklen_t(MemoryLayout<sockaddr_in>.size)
    let client = withUnsafeMutablePointer(to: &clientAddress) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { accept(server, $0, &length) }
    }
    if client >= 0 { DispatchQueue.global().async { handle(client) } }
}
