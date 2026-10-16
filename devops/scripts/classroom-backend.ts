import { startClassroomServer } from "../local/server";

const port = Number(process.env.API_PORT || 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("API_PORT must be an integer from 0 to 65535.");
const runtime = await startClassroomServer(process.cwd(), port);
console.log(
  `Classroom API ready on http://127.0.0.1:${runtime.port}. Database: .local/database/`,
);
if (process.connected)
  process.send?.({ type: "api-ready", port: runtime.port });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await runtime.close();
  process.exit(0);
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void stop();
  });
process.on("message", (message) => {
  if (message === "shutdown") void stop();
});
process.on("disconnect", () => {
  void stop();
});
