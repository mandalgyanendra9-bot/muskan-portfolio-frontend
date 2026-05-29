const BACKEND_URL = (import.meta.env.VITE_API_URL || "https://muskan-portfolio-backend.onrender.com").replace(/\/+$/, "");

export const getProfilePhotoCandidate = (userOrValue = "") => {
  if (typeof userOrValue === "string") return userOrValue;

  return (
    userOrValue?.profilePhotoUrl ||
    userOrValue?.profileImageUrl ||
    userOrValue?.profileImage ||
    userOrValue?.profilePhoto ||
    userOrValue?.photoUrl ||
    userOrValue?.avatar ||
    userOrValue?.googlePhoto ||
    userOrValue?.image ||
    ""
  );
};

export const resolveProfilePhotoUrl = (userOrValue = "") => {
  const candidate = getProfilePhotoCandidate(userOrValue);
  if (!candidate) return "";

  const text = String(candidate).trim();
  if (!text) return "";

  if (/^(https?:|data:|blob:)/i.test(text)) return text;
  if (text.startsWith("/uploads")) return `${BACKEND_URL}${text}`;
  if (text.startsWith("/")) return `${BACKEND_URL}${text}`;

  return `${BACKEND_URL}/${text}`;
};

export const getInitials = (name = "") => {
  const text = String(name || "").trim();
  if (!text) return "U";

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const BACKEND_PUBLIC_URL = BACKEND_URL;
