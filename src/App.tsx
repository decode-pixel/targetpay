import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ModeProvider } from "@/contexts/ModeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Expenses from "./pages/Expenses";
import Categories from "./pages/Categories";
import Budgets from "./pages/Budgets";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <ModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/pricing" element={<Pricing />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </ModeProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
