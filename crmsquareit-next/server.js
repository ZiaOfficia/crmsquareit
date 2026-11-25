// Startup file for hosting panels (Plesk / cPanel "Node.js" app) that need a single JS entry file.
// Run `npm run build` first, then point the panel's "Application startup file" at this file.
const { createServer } = require("http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Squareit CRM running on port ${port}`);
  });
});
