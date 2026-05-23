const DEFAULT_ADMIN_EMAIL = "mandalgyanu2823297@gmail.com";

export const getAdminEmail = () =>
  String(import.meta.env.VITE_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();

export const isAdminUser = (user) => {
  const email = String(user?.email || "").trim().toLowerCase();
  return user?.role === "admin" || email === getAdminEmail();
};
