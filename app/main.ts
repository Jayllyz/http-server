import * as net from "node:net";

function parseRequest(buffer: string): [string, string] {
  const [method, path] = buffer.split(" ");
  return [method, path];
}

function echoHandler(path: string): string {
  return path.slice(6);
}

const server = net.createServer((socket) => {
  console.log("connected");
  socket.on("data", (data) => {
    const buffer = data.toString();
    if (buffer.includes("\r\n")) {
      const [method, path] = parseRequest(buffer);
      console.log(method, path);
      if (path === "/") {
        socket.write("HTTP/1.1 200 OK\r\n\r\n");
      } else if (path.startsWith("/echo/")) {
        const response = echoHandler(path);
        const length = response.length;
        socket.write(
          `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${length}\r\n\r\n${response}\r\n\r\n`,
        );
      } else {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      }
    }
  });
  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");
