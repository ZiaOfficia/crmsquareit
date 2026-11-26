import { dirname } from "path";
import { fileURLToPath } from "url";

/** @type {import("next").NextConfig} */
const nextConfig = {
  // This folder is the app. Without this, Next.js sees the repo root's package-lock.json
  // and traces server files from the wrong root.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // PDF generation (quotations) runs in Node and shouldn't be bundled by webpack.
  serverExternalPackages: ["@react-pdf/renderer", "@react-pdf/pdfkit", "pdfkit", "fontkit"],
  // pdfkit loads its built-in fonts (Helvetica…) with a runtime require("#standard-fonts/…"),
  // which Vercel's file tracing can't follow, so those files were left out of the deployment
  // and every PDF route crashed on Vercel. Ship them explicitly.
  outputFileTracingIncludes: {
    "/admin/**": [
      "./node_modules/pdfkit/package.json",
      "./node_modules/pdfkit/js/standard-fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*",
      // The CRM Assistant reads its guides from here at runtime.
      "./src/knowledge/**/*",
    ],
  },
};
export default nextConfig;
