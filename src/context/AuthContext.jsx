import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return null;
    const parsed = JSON.parse(savedUser);
    return {
      ...parsed,
      isAdmin: parsed?.role?.toLowerCase() === "admin" || parsed?.isAdmin || false,
    };
  });

  const login = (data) => {
    // Ensure admin flag is present for role based checks
    const enriched = {
      ...data,
      isAdmin: data?.role?.toLowerCase() === 'admin' || data?.isAdmin || false,
    };
    localStorage.setItem("user", JSON.stringify(enriched));
    setUser(enriched);
  };

  const updateUser = (data) => {
    const enriched = {
      ...data,
      isAdmin: data?.role?.toLowerCase() === 'admin' || data?.isAdmin || false,
    };
    localStorage.setItem("user", JSON.stringify(enriched));
    setUser(enriched);
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);