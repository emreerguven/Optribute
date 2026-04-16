import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "optribute",
    short_name: "optribute",
    description: "QR ordering for water distributors and dealers",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ea",
    theme_color: "#0f766e",
    icons: []
  };
}
