import http from "http";
import { createApp } from "@/app";
import envConfig from "@/config/env";
import { connectDB } from "@/db/index";
import { SocketService } from "@/providers/socket";

async function bootstrap() {
  try {
    const app = createApp();
    await connectDB();

    app.set("port", envConfig.PORT);

    // Using separate http module for creating server to have
    // advanced control over behavior of server
    const server = http.createServer(app);

    const socketService = new SocketService(server);

    // Store socket service in app for global access
    app.set("socketService", socketService);

    server.listen(envConfig.PORT, () =>
      console.info(`API running on localhost:${envConfig.PORT}`),
    );
  } catch (err) {
    console.error(err, "Error in Server File");
  }
}

bootstrap();
