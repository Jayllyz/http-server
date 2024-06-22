import fs from "node:fs";
import * as net from "node:net";
import zlib from "node:zlib";

function parseRequest(buffer: string): [string, string] {
  const [method, path] = buffer.split(" ");
  return [method, path];
}

function parseBody(buffer: string): string {
  return buffer.split("\r\n\r\n")[1];
}

function echoHandler(path: string): string {
  return path.slice(6);
}

function extractDirectory(): string {
  const index = process.argv.indexOf("--directory");
  return index > 0 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : "";
}

function compressBody(body: string, encoding: string): string {
  switch (encoding) {
    case "gzip": {
      const compressed = zlib.gzipSync(body).toString("base64");
      return compressed;
    }
    case "deflate": {
      const compressed = zlib.deflateSync(body).toString("base64");
      return compressed;
    }

    default:
      return body;
  }
}

// Only gzip is supported for this implementation
function parseEncoding(buffer: string): string {
  if (!buffer.includes("Accept-Encoding: ")) return "";

  const acceptEncoding = buffer.split("Accept-Encoding: ")[1].split("\r\n")[0];
  if (!acceptEncoding) return "";

  const encodings = acceptEncoding.split(",");
  for (const type of encodings) {
    if (type.trim() === "gzip") {
      return "gzip";
    }
  }

  return "";
}

function handleGetRequest(path: string, buffer: string): string {
  const encoding = parseEncoding(buffer);

  switch (path) {
    case "/":
      return "HTTP/1.1 200 OK\r\n\r\n";
    case "/user-agent": {
      const userAgent = buffer.split("User-Agent: ")[1].split("\r\n")[0];
      const length = userAgent.length;
      return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${length}\r\n\r\n${userAgent}\r\n\r\n`;
    }
    case path.startsWith("/echo/") ? path : null: {
      const response = echoHandler(path);
      const length = response.length;
      if (encoding !== "") {
        const compressed = compressBody(response, encoding);
        return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Encoding: ${encoding}\r\nContent-Length: ${compressed.length}\r\n\r\n${compressed}\r\n\r\n`;
      }

      return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${length}\r\n\r\n${response}\r\n\r\n`;
    }
    case path.startsWith("/files/") ? path : null: {
      const fileName = path.slice(7);
      const directory = extractDirectory();

      if (!fs.existsSync(`${directory}/${fileName}`)) {
        return "HTTP/1.1 404 Not Found\r\n\r\n";
      }
      const content = fs.readFileSync(`${directory}/${fileName}`, "utf-8");
      const length = content.length;
      if (encoding !== "") {
        const compressed = compressBody(content, encoding);
        return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Encoding: ${encoding}\r\nContent-Length: ${compressed.length}\r\n\r\n${compressed}\r\n\r\n`;
      }

      return `HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: ${length}\r\n\r\n${content}\r\n\r\n`;
    }
    default:
      return "HTTP/1.1 404 Not Found\r\n\r\n";
  }
}

function handlePostRequest(path: string, buffer: string): string {
  const encoding = parseEncoding(buffer);

  switch (path) {
    case path.startsWith("/files/") ? path : null: {
      const fileName = path.slice(7);
      const directory = extractDirectory();

      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
      }

      const content = parseBody(buffer);
      fs.writeFileSync(`${directory}/${fileName}`, content);

      if (encoding !== "") {
        const compressed = compressBody(content, encoding);
        return `HTTP/1.1 201 Created\r\nContent-Encoding: ${encoding}\r\nContent-Length: ${compressed.length}\r\n\r\n${compressed}\r\n\r\n`;
      }

      return "HTTP/1.1 201 Created\r\n\r\n";
    }
    default:
      return "HTTP/1.1 404 Not Found\r\n\r\n";
  }
}

const server = net.createServer((socket) => {
  console.log("connected");
  socket.on("data", (data) => {
    const buffer = data.toString();
    if (buffer.includes("\r\n")) {
      const [method, path] = parseRequest(buffer);
      console.log(method, path);

      switch (method) {
        case "GET": {
          socket.write(handleGetRequest(path, buffer));
          break;
        }
        case "POST": {
          socket.write(handlePostRequest(path, buffer));
          break;
        }
        default:
          socket.write("HTTP/1.1 405 Method Not Allowed\r\n\r\n");
      }
    }
  });
  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");
