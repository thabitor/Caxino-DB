import { createContext, useContext, useEffect, useState, useRef } from "react";
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

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
    ),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isInitializing = useRef(false);
  const isFetchingUser = useRef(false);

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    const initAuth = async () => {
      // Prevent duplicate initialization
      if (isInitializing.current) return;
      isInitializing.current = true;

      try {
        // Fetch session with timeout protection
        const currentSession = await withTimeout(
          authService.getCurrentSession(),
          5000 // 5 second timeout
        );
        
        setSession(currentSession);
        
        // Only fetch user if we have a session
        if (currentSession?.user) {
          // Use session user data directly instead of extra API call
          setUser({
            id: currentSession.user.id,
            email: currentSession.user.email || "",
            user_metadata: currentSession.user.user_metadata,
            created_at: currentSession.user.created_at
          });
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        // On timeout or error, set empty state and continue
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
        isInitializing.current = false;
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change:", event, session ? "Session exists" : "No session");
        
        setSession(session);
        
        if (session?.user) {
          // Use session user data directly - no extra API call needed
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            user_metadata: session.user.user_metadata,
            created_at: session.user.created_at
          });
        } else {
          setUser(null);
          
          // Handle sign out event - redirect to login
          if (event === 'SIGNED_OUT') {
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
      // Prevent duplicate fetches
      if (isFetchingUser.current) {
        return { error: "Sign in already in progress" };
      }
      isFetchingUser.current = true;

      // Add timeout protection to sign-in
      const { user: authUser, error } = await withTimeout(
        authService.signIn(email, password),
        10000 // 10 second timeout for sign-in
      );
      
      if (error) {
        return { error: error.message };
      }
      
      // User will be set by the auth state change listener
      // No need to set it here to avoid duplicate operations
      
      return { error: null };
    } catch (error) {
      console.error("Sign in error:", error);
      return { error: "Sign in timeout or network error. Please try again." };
    } finally {
      isFetchingUser.current = false;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      // Prevent duplicate fetches
      if (isFetchingUser.current) {
        return { error: "Sign up already in progress" };
      }
      isFetchingUser.current = true;

      // Add timeout protection to sign-up
      const { user: authUser, error } = await withTimeout(
        authService.signUp(email, password),
        10000 // 10 second timeout for sign-up
      );
      
      if (error) {
        return { error: error.message };
      }
      
      // User will be set by the auth state change listener
      
      return { error: null };
    } catch (error) {
      console.error("Sign up error:", error);
      return { error: "Sign up timeout or network error. Please try again." };
    } finally {
      isFetchingUser.current = false;
    }
  };

  const signOut = async () => {
    try {
      // Clear local state immediately for better UX
      setUser(null);
      setSession(null);
      
      // Perform actual sign out with timeout
      await withTimeout(authService.signOut(), 5000);
      
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
