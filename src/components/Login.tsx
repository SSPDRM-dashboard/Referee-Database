import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import React, { useState } from "react";

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [tmId, setTmId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!tmId.trim()) {
        throw new Error("Please enter a valid TM Blackbelt ID.");
      }

      // We use a dummy email domain internally for Firebase Auth
      const cleanTMId = tmId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      let dummyEmail = `${cleanTMId}@tmreferee.local`;

      try {
        const mappingDoc = await getDoc(doc(db, "login_mappings", cleanTMId));
        if (mappingDoc.exists() && mappingDoc.data().email) {
          dummyEmail = mappingDoc.data().email;
        }
      } catch (e) {
        console.error("Mapping read failed", e);
      }

      const result = await signInWithEmailAndPassword(
        auth,
        dummyEmail,
        password,
      );
      const userDoc = await getDoc(doc(db, "users", result.user.uid));

      if (userDoc.exists() && userDoc.data().role === "admin") {
        navigate("/admin");
      } else {
        navigate("/profile");
      }
    } catch (err: any) {
      console.error(err);
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Invalid TM Blackbelt ID or Password.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      let role = "user";
      if (!userDoc.exists()) {
        if (user.email === "anak2nsky@gmail.com") {
          role = "admin";
        }
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          role: role,
          fullName: user.displayName || "New User",
          createdAt: new Date().toISOString(),
        });
      } else {
        role = userDoc.data().role;
      }

      if (role === "admin") {
        navigate("/admin");
      } else {
        navigate("/profile");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-border text-center">
        <img 
          src="https://ouhnnj8dinujboyi.public.blob.vercel-storage.com/logo.png" 
          alt="TM Logo" 
          className="h-40 w-auto object-contain mx-auto mb-6" 
        />
        <h1 className="text-2xl font-extrabold text-primary mb-2 uppercase tracking-tight">
          TM Referee Registry
        </h1>
        <p className="text-muted mb-8 text-sm">
          Sign in to access your dashboard
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4 mb-6">
          <div className="text-left">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
              TM Blackbelt ID
            </label>
            <input
              type="text"
              placeholder="e.g. TM-12345"
              value={tmId}
              onChange={(e) => setTmId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              required
            />
          </div>
          <div className="text-left">
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              required
            />
          </div>
          <div className="flex justify-end mt-1">
            <button
              type="button"
              onClick={() =>
                alert(
                  "To reset your password, please contact the administrator (or the bootsrapped admin). They will assign you a new temporary password from their dashboard.",
                )
              }
              className="text-xs text-primary font-bold hover:underline"
            >
              Forgot Password?
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors mt-4 disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Login as Referee"}
          </button>
        </form>

        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink-0 mx-4 text-muted text-xs uppercase font-bold">
            Admin Access
          </span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full bg-white border border-border text-primary font-bold py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
