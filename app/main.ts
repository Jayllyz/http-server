import * as net from "node:net";

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const buffer = data.toString();
    if (buffer.includes("\r\n")) {
      const [method, path] = buffer.split(" ");
      console.log("method: ", method, "path: ", path);
      if (path === "/") {
        socket.write("HTTP/1.1 200 OK\r\n\r\n");
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
