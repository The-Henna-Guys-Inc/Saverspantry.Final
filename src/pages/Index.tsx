import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { HomeAuthed } from "@/components/HomeAuthed";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (user) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <HomeAuthed user={user} />
      </main>
    );
  }

  return <Navigate to="/welcome" replace />;};

export default Index;
