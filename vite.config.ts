import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://lbrbsexqfzsblyuirkwf.supabase.co'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxicmJzZXhxZnpzYmx5dWlya3dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTc1MjMsImV4cCI6MjA4NjA3MzUyM30.SMEyU3A3d_tkjhT7rtlNymqtPiDmq6Dfnhbb6LNaN9k'),
    'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify('lbrbsexqfzsblyuirkwf'),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
