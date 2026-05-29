import { useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";
import { resolveProfilePhotoUrl } from "../utils/profilePhoto";

function UploadDP() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Image select
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  // Upload image
  const handleUpload = async () => {
    if (!image) {
      toast.error("Please select an image");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", image);

    const token = localStorage.getItem("token");

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/upload/dp`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: token,
          },
        }
      );

      const imageUrl = resolveProfilePhotoUrl(res.data.profilePhotoUrl || res.data.imageUrl || res.data.user);
      
      // Update user in localStorage
      const user = JSON.parse(localStorage.getItem("user"));
      if (user) {
        user.profilePhotoUrl = imageUrl;
        user.profileImage = imageUrl;
        user.profilePhoto = imageUrl;
        user.photoUrl = imageUrl;
        user.avatar = imageUrl;
        localStorage.setItem("user", JSON.stringify(user));
      }
      
      toast.success("Profile picture updated!");
    } catch (error) {
      console.log(error);
      toast.error("Upload failed. Make sure the server is running.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-6 pt-32 relative overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px] -z-10 animate-pulse" />
        
        <div className="glass p-12 rounded-[2.5rem] w-full max-w-lg text-center border-white/5 relative shadow-2xl">
          <h1 className="text-3xl font-bold mb-8">Update <span className="text-primary-400">Profile Picture</span></h1>
          
          <div className="mb-10 relative inline-block group">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="w-48 h-48 rounded-full mx-auto object-cover border-4 border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-105"
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="w-48 h-48 rounded-full mx-auto bg-white/5 border-4 border-dashed border-white/10 flex items-center justify-center text-slate-500 group-hover:border-primary-500/30 transition-colors">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <label className="absolute bottom-2 right-2 bg-primary-500 hover:bg-primary-600 p-3 rounded-full cursor-pointer shadow-lg transition-all active:scale-90">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
            </label>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleUpload}
              disabled={isUploading || !image}
              className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg ${
                isUploading || !image 
                  ? "bg-slate-700 text-slate-500 cursor-not-allowed" 
                  : "bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/20 active:scale-[0.98]"
              }`}
            >
              {isUploading ? "Uploading..." : "Save Profile Picture"}
            </button>
            <p className="text-slate-500 text-sm">Supported formats: JPG, PNG, GIF</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default UploadDP;
