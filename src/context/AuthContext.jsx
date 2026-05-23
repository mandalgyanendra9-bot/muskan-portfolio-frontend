import { createContext, useContext, useState } from "react";
import { isAdminUser } from "../utils/adminAccess";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return null;
    const parsed = JSON.parse(savedUser);
    return {
      ...parsed,
      isAdmin: isAdminUser(parsed),
    };
  });

  const login = (data) => {
    // Ensure admin flag is present for role based checks
    const enriched = {
      ...data,
      isAdmin: isAdminUser(data),
    };
    localStorage.setItem("user", JSON.stringify(enriched));
    setUser(enriched);
  };

  const updateUser = (data) => {
    const enriched = {
      ...data,
      isAdmin: isAdminUser(data),
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
