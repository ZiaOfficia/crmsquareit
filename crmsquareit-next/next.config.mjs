import { dirname } from "path";
import { fileURLToPath } from "url";

/** @type {import("next").NextConfig} */
const nextConfig = {
  // This folder is the app. Without this, Next.js sees the repo root's package-lock.json
  // and traces server files from the wrong root.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // PDF generation (quotations) runs in Node and shouldn't be bundled by webpack.
  serverExternalPackages: ["@react-pdf/renderer", "@react-pdf/pdfkit", "pdfkit", "fontkit"],
};
export default nextConfig;
