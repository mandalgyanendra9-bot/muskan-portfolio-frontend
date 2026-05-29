export const isAdminUser = (user) => {
  return user?.role === "admin" || user?.isAdmin || user?.isSuperAdmin || user?.displayRole === "Super Admin";
};
