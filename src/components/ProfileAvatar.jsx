import { useEffect, useState } from "react";
import { getInitials, resolveProfilePhotoUrl } from "../utils/profilePhoto";

const ProfileAvatar = ({
  user = {},
  src = "",
  alt = "",
  className = "",
  imageClassName = "h-full w-full object-cover",
  fallbackClassName = "flex items-center justify-center bg-primary-500/15 font-bold text-primary-200",
  onClick,
  title,
  loading = "lazy",
  decoding = "async",
  fetchPriority,
}) => {
  const [hasError, setHasError] = useState(false);

  const resolvedSrc = resolveProfilePhotoUrl(src || user);
  const displayName = alt || user?.name || "User";
  const initials = getInitials(displayName);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc, user?.profilePhotoUrl, user?.profileImage, user?.profilePhoto, user?.photoUrl, user?.avatar, user?.googlePhoto, user?.image]);

  if (!resolvedSrc || hasError) {
    return (
      <div className={`${className} ${fallbackClassName}`} onClick={onClick} title={title || displayName}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={displayName}
      title={title || displayName}
      onClick={onClick}
      onError={() => setHasError(true)}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      className={`${className} ${imageClassName}`}
    />
  );
};

export default ProfileAvatar;
