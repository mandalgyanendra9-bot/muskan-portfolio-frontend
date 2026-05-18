import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import toast from "react-hot-toast";

const Admin = () => {
  const [activeTab, setActiveTab] = useState("analytics"); // analytics, approvals, users, payments
  
  // Dashboard & Analytics states
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [messages, setMessages] = useState([]);
  
  const [loading, setLoading] = useState(true);

  // Search queries for directories
  const [userSearch, setUserSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: token };

      const [analyticsRes, usersRes, paymentsRes, messagesRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/admin/analytics`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/admin/users`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/admin/payments`, { headers }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/contact`, { headers })
      ]);

      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data);
      setPayments(paymentsRes.data);
      setMessages(messagesRes.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load admin workspace data. Please verify role rights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Toggle Expert Approval Status
  const handleToggleApproval = async (expertId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/admin/expert/${expertId}/approve`,
        {},
        { headers: { Authorization: token } }
      );
      toast.success(res.data.message);
      fetchData(); // Refresh metrics
    } catch (err) {
      toast.error("Failed to update expert approval status");
    }
  };

  // Delete User
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("CRITICAL ACTION: Are you sure you want to permanently delete this user account? All associated bookings will remain inactive.")) return;
    
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/admin/user/${userId}`, {
        headers: { Authorization: token }
      });
      toast.success("User deleted successfully");
      fetchData();
    } catch (err) {
      toast.error("Failed to delete user account");
    }
  };

  // Filters for directories
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredPayments = payments.filter(p => 
    p.client?.name.toLowerCase().includes(paymentSearch.toLowerCase()) ||
    p.expert?.name.toLowerCase().includes(paymentSearch.toLowerCase()) ||
    p.paymentId?.toLowerCase().includes(paymentSearch.toLowerCase())
  );

  const expertsList = users.filter(u => u.role === "expert");

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SEO title="System Administrator Cockpit" description="Review metrics, approve tech experts, audit ledger accounts, and manage registrations." />
      <Navbar />

      <div className="flex-1 section-padding pt-32 pb-20 max-w-7xl mx-auto w-full">
        <div className="space-y-12">
          {/* Header */}
          <div className="flex justify-between items-end flex-wrap gap-4">
            <div>
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                System Admin
              </span>
              <h1 className="text-4xl font-extrabold text-white mt-4">Administrative Console</h1>
            </div>
            <button
              onClick={fetchData}
              className="bg-white/5 hover:bg-white/10 text-white font-bold py-3 px-6 rounded-2xl transition-all border border-white/10 active:scale-95 text-sm"
            >
              🔄 Reload Ledgers
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex gap-4 border-b border-white/5 pb-4 overflow-x-auto">
            {[
              { id: "analytics", label: "Analytics Cockpit", icon: "📊" },
              { id: "approvals", label: "Expert Approvals", icon: "✅" },
              { id: "users", label: "User Management", icon: "👤" },
              { id: "payments", label: "Audit Payments", icon: "💳" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2 px-4 font-bold transition-all border-b-2 text-lg whitespace-nowrap ${
                  activeTab === tab.id ? "border-primary-500 text-white" : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <span className="mr-2">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-32 flex justify-center"><div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <div>
              {/* ANALYTICS COCKPIT */}
              {activeTab === "analytics" && analytics && (
                <div className="space-y-12">
                  {/* KPI Widgets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-36 shadow-xl">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Total Users</span>
                      <h3 className="text-3xl font-extrabold text-white">{analytics.metrics.totalUsers}</h3>
                      <span className="text-[10px] text-slate-400">{analytics.metrics.totalClients} Clients registered</span>
                    </div>

                    <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-36 shadow-xl">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Total Experts</span>
                      <h3 className="text-3xl font-extrabold text-white">{analytics.metrics.totalExperts}</h3>
                      <span className="text-[10px] text-emerald-400">{analytics.metrics.approvedExperts} approved</span>
                    </div>

                    <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-36 shadow-xl border-l-yellow-500/20">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Pending Approvals</span>
                      <h3 className="text-3xl font-extrabold text-yellow-400">{analytics.metrics.pendingApprovals}</h3>
                      <span className="text-[10px] text-slate-400">Needs administrative review</span>
                    </div>

                    <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-36 shadow-xl">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Total Bookings</span>
                      <h3 className="text-3xl font-extrabold text-white">{analytics.metrics.totalBookings}</h3>
                      <span className="text-[10px] text-slate-400">Session ledger entries</span>
                    </div>

                    <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-36 shadow-xl border-l-primary-500/20">
                      <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Gross Revenue</span>
                      <h3 className="text-3xl font-extrabold text-primary-400">₹{analytics.metrics.totalRevenue}</h3>
                      <span className="text-[10px] text-emerald-400 font-medium">Earned through consultations</span>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-12">
                    {/* Latest Bookings */}
                    <div className="space-y-6">
                      <h3 className="text-2xl font-bold text-white border-b border-white/5 pb-2">Recent Platform Sessions</h3>
                      <div className="space-y-4">
                        {analytics.latestBookings?.map(b => (
                          <div key={b._id} className="glass p-5 rounded-2xl border-white/5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-sm font-bold text-primary-400">
                                💻
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-sm">{b.client?.name} booked {b.expert?.name}</h4>
                                <p className="text-[10px] text-slate-500 font-mono">{new Date(b.date).toLocaleDateString()} · {b.duration}hr session</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                b.status === "confirmed" ? "bg-emerald-500/10 text-emerald-400" :
                                b.status === "pending" ? "bg-yellow-500/10 text-yellow-400" :
                                "bg-primary-500/10 text-primary-400"
                              }`}>
                                {b.status}
                              </span>
                              <p className="text-xs font-bold text-white mt-1">₹{b.totalPrice}</p>
                            </div>
                          </div>
                        ))}
                        {analytics.latestBookings?.length === 0 && (
                          <p className="text-slate-500 text-center py-10">No sessions recorded yet.</p>
                        )}
                      </div>
                    </div>

                    {/* Content control & Quick shortcuts */}
                    <div className="space-y-6">
                      <h3 className="text-2xl font-bold text-white border-b border-white/5 pb-2">Admin Shortcuts</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <Link to="/manage-projects" className="glass p-6 rounded-2xl border-white/5 hover:border-primary-500/20 transition-all text-left">
                          <h4 className="font-bold text-lg text-white">Projects Desk</h4>
                          <p className="text-xs text-slate-500 mt-1">Audit or publish direct works.</p>
                        </Link>
                        <Link to="/blog" className="glass p-6 rounded-2xl border-white/5 hover:border-primary-500/20 transition-all text-left">
                          <h4 className="font-bold text-lg text-white">Articles Desk</h4>
                          <p className="text-xs text-slate-500 mt-1">Manage technical publications.</p>
                        </Link>
                      </div>
                      
                      <div className="glass p-6 rounded-2xl border-white/5 space-y-4">
                        <h4 className="font-bold text-white">Inbound Inquiries inbox ({messages.length})</h4>
                        <div className="space-y-3">
                          {messages.slice(0, 2).map(m => (
                            <div key={m._id} className="bg-white/5 p-4 rounded-xl text-xs space-y-1">
                              <div className="flex justify-between font-bold text-white">
                                <span>{m.name}</span>
                                <span className="text-slate-500 font-mono">{m.email}</span>
                              </div>
                              <p className="text-slate-400 italic">"{m.message}"</p>
                            </div>
                          ))}
                          <Link to="/messages" className="text-primary-400 text-xs font-bold hover:underline block text-right mt-2">
                            View Full Message Inbox →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* EXPERT APPROVALS */}
              {activeTab === "approvals" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <h3 className="text-2xl font-bold text-white">Approve Consulting Experts</h3>
                    <span className="bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold">
                      {expertsList.filter(e => !e.isApproved).length} Pending Review
                    </span>
                  </div>

                  <div className="grid gap-6">
                    {expertsList.map(expert => (
                      <div key={expert._id} className="glass p-6 rounded-2xl border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
                          <img
                            src={expert.profileImage ? `${import.meta.env.VITE_API_URL}${expert.profileImage}` : "https://via.placeholder.com/100"}
                            alt={expert.name}
                            className="w-14 h-14 rounded-full object-cover border border-white/10"
                          />
                          <div>
                            <h4 className="font-bold text-white text-lg">{expert.name}</h4>
                            <p className="text-primary-400 text-xs">{expert.title} · {expert.email}</p>
                            <p className="text-slate-400 text-xs mt-1 italic line-clamp-1">"{expert.bio || 'No bio submitted yet.'}"</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="text-center sm:text-right hidden sm:block">
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Rate</p>
                            <p className="text-sm font-bold text-white font-mono">₹{expert.hourlyRate}/hr</p>
                          </div>
                          
                          <button
                            onClick={() => handleToggleApproval(expert._id)}
                            className={`flex-grow sm:flex-grow-0 px-6 py-3 rounded-xl font-bold transition-all text-xs active:scale-95 ${
                              expert.isApproved
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                            }`}
                          >
                            {expert.isApproved ? "Suspend Approval" : "Approve Expert"}
                          </button>
                        </div>
                      </div>
                    ))}
                    {expertsList.length === 0 && (
                      <p className="text-slate-500 text-center py-10">No experts registered on the platform yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* USER MANAGEMENT */}
              {activeTab === "users" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center flex-wrap gap-4 pb-2 border-b border-white/5">
                    <h3 className="text-2xl font-bold text-white">System User Index</h3>
                    <input
                      type="text"
                      placeholder="Search accounts..."
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-primary-500 w-full sm:w-60"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>

                  <div className="glass rounded-3xl overflow-hidden border-white/5">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-xs font-bold uppercase">
                          <th className="p-4">Name</th>
                          <th className="p-4">Email</th>
                          <th className="p-4">Role</th>
                          <th className="p-4">Joined</th>
                          <th className="p-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {filteredUsers.map(u => (
                          <tr key={u._id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 font-bold text-white">{u.name}</td>
                            <td className="p-4 font-mono text-xs">{u.email}</td>
                            <td className="p-4 capitalize">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                u.role === "admin" ? "bg-red-500/20 text-red-400" :
                                u.role === "expert" ? "bg-primary-500/20 text-primary-400" :
                                "bg-emerald-500/20 text-emerald-400"
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-4 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td className="p-4 text-center">
                              {u.role !== "admin" ? (
                                <button
                                  onClick={() => handleDeleteUser(u._id)}
                                  className="text-red-400 hover:text-red-500 font-bold text-xs"
                                >
                                  Delete Account
                                </button>
                              ) : (
                                <span className="text-slate-600 text-xs">Immutable</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                      <p className="text-slate-500 text-center py-10">No users match the search terms.</p>
                    )}
                  </div>
                </div>
              )}

              {/* AUDIT PAYMENTS */}
              {activeTab === "payments" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center flex-wrap gap-4 pb-2 border-b border-white/5">
                    <h3 className="text-2xl font-bold text-white">Payment Transaction Logs</h3>
                    <input
                      type="text"
                      placeholder="Search transactions..."
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-primary-500 w-full sm:w-60"
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                    />
                  </div>

                  <div className="glass rounded-3xl overflow-hidden border-white/5">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-xs font-bold uppercase">
                          <th className="p-4">Billing Client</th>
                          <th className="p-4">Expert Consultant</th>
                          <th className="p-4">Transaction ID</th>
                          <th className="p-4">Amount</th>
                          <th className="p-4">Paid On</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {filteredPayments.map(p => (
                          <tr key={p._id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4 font-bold text-white">{p.client?.name || "Deleted User"}</td>
                            <td className="p-4">{p.expert?.name || "Expert"}</td>
                            <td className="p-4 font-mono text-xs text-primary-400">{p.paymentId || "demo_sandbox_trx"}</td>
                            <td className="p-4 font-mono font-bold text-white">₹{p.totalPrice}</td>
                            <td className="p-4 text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredPayments.length === 0 && (
                      <p className="text-slate-500 text-center py-10">No payment transaction records found.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Admin;