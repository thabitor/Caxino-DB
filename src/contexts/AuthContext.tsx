
import { createContext, useContext, useEffect, useState } from "react";
import { authService, type AuthUser } from "@/services/authService";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/router";

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    const initAuth = async () => {
      try {
        const currentSession = await authService.getCurrentSession();
        setSession(currentSession);
        
        if (currentSession) {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change:", event, session ? "Session exists" : "No session");
        
        setSession(session);
        if (session) {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
        } else {
          setUser(null);
          
          // Handle sign out event - redirect to login
          if (event === 'SIGNED_OUT') {
            // Use replace to prevent back navigation to protected pages
            router.replace('/auth/login');
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const signIn = async (email: string, password: string) => {
    try {
      const { user: authUser, error } = await authService.signIn(email, password);
      if (error) {
        return { error: error.message };
      }
      setUser(authUser);
      return { error: null };
    } catch (error) {
      console.error("Sign in error:", error);
      return { error: "Failed to sign in. Please try again." };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { user: authUser, error } = await authService.signUp(email, password);
      if (error) {
        return { error: error.message };
      }
      setUser(authUser);
      return { error: null };
    } catch (error) {
      console.error("Sign up error:", error);
      return { error: "Failed to sign up. Please try again." };
    }
  };

  const signOut = async () => {
    try {
      // Clear local state immediately for better UX
      setUser(null);
      setSession(null);
      
      // Perform actual sign out
      const { error } = await authService.signOut();
      
      if (error) {
        console.error("Sign out error:", error);
        throw new Error(error.message);
      }
      
      // Force redirect to login page
      await router.replace('/auth/login');
      
      // Force a hard refresh to clear any remaining state
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    } catch (error) {
      console.error("Sign out exception:", error);
      // Even if sign out fails, redirect to login
      await router.replace('/auth/login');
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
