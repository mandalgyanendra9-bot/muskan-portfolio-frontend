export const isAdminUser = (user) => {
  return user?.role === "admin";
};
