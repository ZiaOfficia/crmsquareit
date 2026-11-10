/** @type {import("next").NextConfig} */
const nextConfig = {
  // PDF generation (quotations) runs in Node and shouldn't be bundled by webpack.
  serverExternalPackages: ["@react-pdf/renderer", "@react-pdf/pdfkit", "pdfkit"],
  // The quotation PDF reads the logo and arrow font from disk; make sure it ships with the server code.
  outputFileTracingIncludes: { "/admin/quotations/[id]/pdf": ["./public/logo-quotation.jpg", "./src/lib/fonts/arrow.ttf"] },
};
export default nextConfig;
