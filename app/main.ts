import * as net from "node:net";

function parseRequest(buffer: string): [string, string] {
  const [method, path] = buffer.split(" ");
  return [method, path];
}

function echoHandler(path: string): string {
  return path.slice(6);
}

function handleGetRequest(path: string, buffer: string): string {
  switch (path) {
    case "/":
      return "HTTP/1.1 200 OK\r\n\r\n";
    case path.startsWith("/echo") ? path : null: {
      const response = echoHandler(path);
      const length = response.length;
      return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${length}\r\n\r\n${response}\r\n\r\n`;
    }
    case "/user-agent": {
      const userAgent = buffer.split("User-Agent: ")[1].split("\r\n")[0];
      const length = userAgent.length;
      return `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${length}\r\n\r\n${userAgent}\r\n\r\n`;
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
