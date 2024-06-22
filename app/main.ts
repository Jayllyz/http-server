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

function compressBody(body: string, encoding: string): Buffer {
  switch (encoding) {
    case "gzip": {
      const buffer = Buffer.from(body, "utf8");
      const compressed = zlib.gzipSync(buffer);
      return compressed;
    }
    case "deflate": {
      const buffer = Buffer.from(body, "utf8");
      const compressed = zlib.deflateSync(buffer);
      return compressed;
    }

    default:
      return Buffer.from(body, "utf8");
  }
}

function parseEncoding(buffer: string): string {
  if (!buffer.includes("Accept-Encoding: ")) return "";

  const acceptEncoding = buffer.split("Accept-Encoding: ")[1].split("\r\n")[0];
  if (!acceptEncoding) return "";

  const encodings = acceptEncoding
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (encodings.includes("gzip")) {
    return "gzip";
  }
  if (encodings.includes("deflate")) {
    return "deflate";
  }

  return "";
}

function handleGetRequest(
  path: string,
  buffer: string,
): { response: string; compressed: Buffer | null } {
  const encoding = parseEncoding(buffer);

  switch (path) {
    case "/":
      return {
        response:
          "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 0\r\n\r\n",
        compressed: null,
      };

    case "/user-agent": {
      const userAgent = buffer.split("User-Agent: ")[1].split("\r\n")[0];
      const length = userAgent.length;
      return {
        response: `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${length}\r\n\r\n${userAgent}\r\n\r\n`,
        compressed: null,
      };
    }
    case path.startsWith("/echo/") ? path : null: {
      const response = echoHandler(path);
      const length = response.length;
      if (encoding !== "") {
        const compressed = compressBody(response, encoding);
        console.log(compressed, response);
        return {
          response: `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Encoding: ${encoding}\r\nContent-Length: ${compressed.length}\r\n\r\n`,
          compressed: compressed,
        };
      }

      return {
        response: `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${length}\r\n\r\n${response}\r\n\r\n`,
        compressed: null,
      };
    }
    case path.startsWith("/files/") ? path : null: {
      const fileName = path.slice(7);
      const directory = extractDirectory();

      if (!fs.existsSync(`${directory}/${fileName}`)) {
        return {
          response: "HTTP/1.1 404 Not Found\r\n\r\n",
          compressed: null,
        };
      }

      const content = fs.readFileSync(`${directory}/${fileName}`, "utf-8");
      const length = content.length;
      if (encoding !== "") {
        const compressed = compressBody(content, encoding);
        return {
          response: `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Encoding: ${encoding}\r\nContent-Length: ${compressed.length}\r\n\r\n`,
          compressed: compressed,
        };
      }

      return {
        response: `HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: ${length}\r\n\r\n${content}\r\n\r\n`,
        compressed: null,
      };
    }
    default:
      return {
        response: "HTTP/1.1 404 Not Found\r\n\r\n",
        compressed: null,
      };
  }
}

function handlePostRequest(
  path: string,
  buffer: string,
): { response: string; compressed: Buffer | null } {
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
        return {
          response: `HTTP/1.1 201 Created\r\nContent-Encoding: ${encoding}\r\nContent-Length: ${compressed.length}\r\n\r\n${compressed}\r\n\r\n`,
          compressed: compressed,
        };
      }

      return {
        response: `HTTP/1.1 201 Created\r\nContent-Length: ${content.length}\r\n\r\n${content}\r\n\r\n`,
        compressed: null,
      };
    }
    default:
      return {
        response: "HTTP/1.1 404 Not Found\r\n\r\n",
        compressed: null,
      };
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
          const { response, compressed } = handleGetRequest(path, buffer);
          socket.write(response);
          if (compressed) {
            socket.write(compressed);
          }
          break;
        }
        case "POST": {
          const { response, compressed } = handlePostRequest(path, buffer);
          socket.write(response);
          if (compressed) {
            socket.write(compressed);
          }
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
