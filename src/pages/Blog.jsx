import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import Skeleton from "../components/Skeleton";

const Blog = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/posts`);
        setPosts(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <SEO 
        title="Blog" 
        description="Read my latest articles on web development, design, and technology." 
        keywords="blog, tech, web development, react, nodejs"
      />
      <Navbar />
      
      <div className="section-padding pt-40 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6">Latest <span className="text-primary-400">Insights</span></h1>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto">
              My thoughts on development, design, and the future of the web.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {loading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />)
            ) : (
              posts.map((post, index) => (
                <motion.article 
                  key={post._id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="glass rounded-[2.5rem] overflow-hidden flex flex-col group border-white/5"
                >
                  <div className="aspect-video relative overflow-hidden">
                    {post.image ? (
                      <img src={`${import.meta.env.VITE_API_URL}${post.image}`} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center text-slate-700">No Image</div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className="bg-primary-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-8 flex-1 flex flex-col">
                    <p className="text-slate-500 text-xs mb-3">{new Date(post.createdAt).toLocaleDateString()}</p>
                    <h3 className="text-2xl font-bold mb-4 group-hover:text-primary-400 transition-colors leading-tight">{post.title}</h3>
                    <p className="text-slate-400 text-sm mb-8 flex-1 line-clamp-3 leading-relaxed">
                      {post.excerpt}
                    </p>
                    <button className="text-primary-400 font-bold flex items-center gap-2 hover:underline group/btn">
                      Read More 
                      <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                    </button>
                  </div>
                </motion.article>
              ))
            )}
            {!loading && posts.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-500">
                No blog posts found. Check back soon!
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Blog;
