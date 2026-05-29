import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import ProfileAvatar from "../components/ProfileAvatar";
import { resolveProfilePhotoUrl } from "../utils/profilePhoto";

const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE = `${API_ROOT}/api`;

const tabs = [
  { id: "overview", label: "Dashboard", short: "DB" },
  { id: "users", label: "Manage Users", short: "US" },
  { id: "profiles", label: "Block/Verify Profiles", short: "PV" },
  { id: "revenue", label: "Revenue Analytics", short: "RA" },
  { id: "payouts", label: "Payout Management", short: "PY" },
  { id: "settings", label: "Admin Settings", short: "AS" },
  { id: "reports", label: "Reports & Complaints", short: "RC" },
  { id: "bookings", label: "Booking Management", short: "BM" },
];

const bookingStatuses = ["pending", "confirmed", "completed", "cancelled"];
const paymentStatuses = ["unpaid", "paid", "refunded"];

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatMoney = (value = 0) => money.format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const lower = (value) => String(value || "").toLowerCase();

const capitalize = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const getAvatarUrl = (user = {}) => {
  return resolveProfilePhotoUrl(user);
};

const getRoleKey = (user = {}) => {
  if (user?.isSuperAdmin || lower(user?.role) === "admin") return "admin";
  if (lower(user?.role) === "expert" || lower(user?.role) === "faculty") return "expert";
  return lower(user?.role) || "client";
};

const getRoleLabel = (user = {}) => user?.displayRole || (getRoleKey(user) === "admin" ? "Super Admin" : getRoleKey(user) === "expert" ? "Faculty" : capitalize(user?.role));

const splitList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { Authorization: token };
};

const getStatusClass = (status) => {
  const classes = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-400/20",
    confirmed: "bg-sky-500/15 text-sky-300 border-sky-400/20",
    completed: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    approved: "bg-sky-500/15 text-sky-300 border-sky-400/20",
    cancelled: "bg-red-500/15 text-red-300 border-red-400/20",
    paid: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    rejected: "bg-red-500/15 text-red-300 border-red-400/20",
    unpaid: "bg-amber-500/15 text-amber-300 border-amber-400/20",
    refunded: "bg-violet-500/15 text-violet-300 border-violet-400/20",
    admin: "bg-violet-500/15 text-violet-300 border-violet-400/20",
    expert: "bg-sky-500/15 text-sky-300 border-sky-400/20",
    faculty: "bg-sky-500/15 text-sky-300 border-sky-400/20",
    client: "bg-slate-500/15 text-slate-300 border-slate-400/20",
  };

  return classes[status] || "bg-slate-500/15 text-slate-300 border-slate-400/20";
};

const StatusBadge = ({ children, status }) => (
  <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${getStatusClass(status)}`}>
    {children}
  </span>
);

const Admin = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [adminSettings, setAdminSettings] = useState({ commissionPercent: 20 });
  const [reports, setReports] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [payoutSearch, setPayoutSearch] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [commissionPercent, setCommissionPercent] = useState(20);
  const [savingSettings, setSavingSettings] = useState(false);
  const [downloadingPayoutReport, setDownloadingPayoutReport] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState({});

  const fetchData = useCallback(async (showToast = false) => {
    setRefreshing(true);
    try {
      const headers = getAuthHeaders();
// Remove duplicate state declarations (already defined at top)
// Fetch payouts along with other admin data
const [analyticsRes, usersRes, paymentsRes, reportsRes, bookingsRes, payoutsRes, settingsRes] = await Promise.all([
  axios.get(`${API_BASE}/admin/analytics`, { headers }),
  axios.get(`${API_BASE}/admin/users`, { headers }),
  axios.get(`${API_BASE}/admin/payments`, { headers }),
  axios.get(`${API_BASE}/admin/reports`, { headers }),
  axios.get(`${API_BASE}/admin/bookings`, { headers }),
  axios.get(`${API_BASE}/admin/payouts`, { headers }),
  axios.get(`${API_BASE}/admin/settings`, { headers }),
]);

setAnalytics(analyticsRes.data);
setUsers(usersRes.data);
setPayments(paymentsRes.data);
setReports(reportsRes.data);
setBookings(bookingsRes.data);
setPayouts(payoutsRes.data);
setAdminSettings(settingsRes.data);
setCommissionPercent(settingsRes.data.commissionPercent ?? 20);
      if (showToast) toast.success("Admin dashboard refreshed");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load admin dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  const runAdminAction = async (request, successMessage) => {
    try {
      await request();
      toast.success(successMessage);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Admin action failed");
    }
  };

  const handleViewProfile = async (user) => {
    setProfileModalOpen(true);
    setProfileLoading(true);
    setSelectedUserProfile(user);

    try {
      const { data } = await axios.get(`${API_BASE}/admin/users/${user._id}`, { headers: getAuthHeaders() });
      setSelectedUserProfile(data);
      setRoleDrafts((current) => ({
        ...current,
        [data._id]: current[data._id] || data.role,
      }));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to load profile details");
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedUserProfile(null);
    setProfileLoading(false);
  };

  const handleRoleChange = async (userId) => {
    const nextRole = roleDrafts[userId];
    if (!nextRole) return;

    try {
      const { data } = await axios.put(`${API_BASE}/admin/user/${userId}/role`, { role: nextRole }, { headers: getAuthHeaders() });
      toast.success(data.message || "Role updated");
      setRoleDrafts((current) => ({ ...current, [userId]: data.user?.role || nextRole }));
      if (selectedUserProfile?._id === userId) {
        setSelectedUserProfile(data.user || null);
      }
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update role");
    }
  };

  const handleToggleApproval = (expertId, isApproved) => {
    runAdminAction(
      () => axios.put(`${API_BASE}/admin/expert/${expertId}/approve`, {}, { headers: getAuthHeaders() }),
      isApproved ? "Expert approval suspended" : "Expert approved"
    );
  };

  const handleToggleBlock = (userId, isBlocked) => {
    runAdminAction(
      () => axios.put(`${API_BASE}/admin/user/${userId}/block`, {}, { headers: getAuthHeaders() }),
      isBlocked ? "User unblocked" : "User blocked"
    );
  };

  const handleToggleVerify = (userId, isVerified) => {
    runAdminAction(
      () => axios.put(`${API_BASE}/admin/user/${userId}/verify`, {}, { headers: getAuthHeaders() }),
      isVerified ? "User marked unverified" : "User verified"
    );
  };

  const handleDeleteUser = (userId) => {
    if (!window.confirm("Delete this user account permanently?")) return;
    runAdminAction(
      () => axios.delete(`${API_BASE}/admin/user/${userId}`, { headers: getAuthHeaders() }),
      "User deleted"
    );
  };

  const handleBookingUpdate = (bookingId, field, value) => {
    runAdminAction(
      () => axios.put(`${API_BASE}/admin/booking/${bookingId}/status`, { [field]: value }, { headers: getAuthHeaders() }),
      "Booking updated"
    );
  };

  const handlePayoutUpdate = (payoutId, status) => {
    const payload = { status };
    if (status === "paid") {
      const transactionId = window.prompt("Enter payout transaction/reference ID, if available:");
      if (transactionId === null) return;
      payload.transactionId = transactionId;
    }

    runAdminAction(
      () => axios.put(`${API_BASE}/admin/payouts/${payoutId}/status`, payload, { headers: getAuthHeaders() }),
      `Payout marked ${status}`
    );
  };

  const handleSaveSettings = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    try {
      const res = await axios.put(
        `${API_BASE}/admin/settings`,
        { commissionPercent: Number(commissionPercent) },
        { headers: getAuthHeaders() }
      );
      setAdminSettings(res.data.settings);
      setCommissionPercent(res.data.settings.commissionPercent);
      toast.success("Admin settings saved");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save admin settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDownloadPayoutReport = async () => {
    setDownloadingPayoutReport(true);
    try {
      const response = await axios.get(`${API_BASE}/admin/payouts/report`, {
        headers: getAuthHeaders(),
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payout-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Payout report downloaded");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to download payout report");
    } finally {
      setDownloadingPayoutReport(false);
    }
  };

  const handleToggleReport = (reportId, isRead) => {
    runAdminAction(
      () => axios.put(`${API_BASE}/admin/report/${reportId}/read`, {}, { headers: getAuthHeaders() }),
      isRead ? "Complaint reopened" : "Complaint marked resolved"
    );
  };

  const handleDeleteReport = (reportId) => {
    if (!window.confirm("Delete this report or complaint?")) return;
    runAdminAction(
      () => axios.delete(`${API_BASE}/admin/report/${reportId}`, { headers: getAuthHeaders() }),
      "Complaint deleted"
    );
  };

  const experts = useMemo(() => users.filter((user) => ["expert", "faculty"].includes(lower(user.role))), [users]);

  const filteredUsers = useMemo(() => {
    const query = lower(userSearch);
    return users.filter((user) =>
      [user.name, user.email, user.role, user.displayRole, user.isBlocked ? "blocked" : "active", user.isEmailVerified ? "verified" : "unverified"]
        .some((field) => lower(field).includes(query))
    );
  }, [users, userSearch]);

  const filteredPayments = useMemo(() => {
    const query = lower(paymentSearch);
    return payments.filter((payment) =>
      [
        payment.client?.name,
        payment.client?.email,
        payment.expert?.name,
        payment.expert?.email,
        payment.paymentId,
        payment.status,
      ].some((field) => lower(field).includes(query))
    );
  }, [payments, paymentSearch]);

  const filteredPayouts = useMemo(() => {
    const query = lower(payoutSearch);
    return payouts.filter((payout) =>
      [
        payout.expert?.name,
        payout.amount,
        payout.commission,
        payout.netAmount,
        payout.payoutMethod,
        payout.payoutDetails?.upiId,
        payout.payoutDetails?.accountHolderName,
        payout.payoutDetails?.bankAccountNumber,
        payout.payoutDetails?.ifscCode,
        payout.status,
        payout.transactionId,
      ].some((field) => lower(field).includes(query))
    );
  }, [payouts, payoutSearch]);

  const filteredReports = useMemo(() => {
    const query = lower(reportSearch);
    return reports.filter((report) =>
      [report.name, report.email, report.message, report.isRead ? "resolved" : "open"]
        .some((field) => lower(field).includes(query))
    );
  }, [reports, reportSearch]);

  const filteredBookings = useMemo(() => {
    const query = lower(bookingSearch);
    return bookings.filter((booking) =>
      [
        booking.client?.name,
        booking.client?.email,
        booking.expert?.name,
        booking.expert?.email,
        booking.status,
        booking.paymentStatus,
        booking.paymentId,
      ].some((field) => lower(field).includes(query))
    );
  }, [bookings, bookingSearch]);

  const metrics = analytics?.metrics || {};
  const pendingExperts = experts.filter((expert) => !expert.isApproved);
  const openReports = reports.filter((report) => !report.isRead);
  const revenueFromPaidBookings = payments.reduce((sum, payment) => sum + (Number(payment.totalPrice) || 0), 0);
  const profileData = selectedUserProfile || {};
  const profileAvatar = getAvatarUrl(profileData);
  const profileResearchInterests = splitList(profileData.researchInterests);
  const profileCounts = {
    publications: Number(profileData.publicationsCount) || 0,
    projects: Number(profileData.projectsCount) || 0,
    patents: Number(profileData.patentsCount) || 0,
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SEO
        title="Admin Dashboard"
        description="Manage users, verify profiles, review revenue, handle reports, and control bookings."
      />
      <Navbar />

      <main className="flex-1 section-padding pt-28 pb-16 max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex rounded-md border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-300">
                Admin Dashboard
              </span>
              <h1 className="mt-4 text-3xl font-extrabold text-white md:text-4xl">Platform Control Center</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Users, profile approvals, revenue, complaints, and bookings in one admin view.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {refreshing ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 md:grid-cols-4 xl:grid-cols-7">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold transition md:text-sm ${
                  activeTab === tab.id
                    ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="rounded border border-current/20 px-1.5 py-0.5 text-[10px]">{tab.short}</span>
                <span className="leading-tight">{tab.label}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex min-h-80 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
              <div className="h-12 w-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {activeTab === "overview" && (
                <section className="space-y-8">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <MetricCard label="Total Users" value={metrics.totalUsers || 0} note={`${metrics.verifiedUsers || 0} verified`} />
                    <MetricCard label="Pending Profiles" value={metrics.pendingApprovals || 0} note={`${metrics.approvedExperts || 0} experts approved`} tone="amber" />
                    <MetricCard label="Gross Revenue" value={formatMoney(metrics.totalRevenue || revenueFromPaidBookings)} note={`${metrics.totalPaidBookings || payments.length} paid bookings`} tone="emerald" />
                    <MetricCard label="Bookings" value={metrics.totalBookings || bookings.length} note={`${metrics.bookingStatusCounts?.completed || 0} completed`} />
                    <MetricCard label="Open Complaints" value={metrics.unreadReports || openReports.length} note={`${reports.length} total reports`} tone="red" />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
                      <SectionHeader title="Latest Bookings" action={<button onClick={() => setActiveTab("bookings")} className="text-xs font-bold text-primary-300">Open Bookings</button>} />
                      <div className="divide-y divide-white/5">
                        {(analytics?.latestBookings || []).map((booking) => (
                          <div key={booking._id} className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                            <div>
                              <p className="font-bold text-white">
                                {booking.client?.name || "Client"} with {booking.expert?.name || "Expert"}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {formatDate(booking.date)} - {booking.duration || 1} hr - {formatMoney(booking.totalPrice)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              <StatusBadge status={booking.status}>{booking.status}</StatusBadge>
                              <StatusBadge status={booking.paymentStatus}>{booking.paymentStatus}</StatusBadge>
                            </div>
                          </div>
                        ))}
                        {(analytics?.latestBookings || []).length === 0 && <EmptyState text="No bookings recorded yet." />}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-lg border border-white/10 bg-white/[0.03]">
                        <SectionHeader title="Profile Queue" action={<button onClick={() => setActiveTab("profiles")} className="text-xs font-bold text-primary-300">Review</button>} />
                        <div className="divide-y divide-white/5">
                          {pendingExperts.slice(0, 4).map((expert) => (
                            <div key={expert._id} className="flex items-center justify-between gap-3 p-4">
                              <UserMini user={expert} />
                              <button
                                type="button"
                                onClick={() => handleToggleApproval(expert._id, expert.isApproved)}
                                className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600"
                              >
                                Approve
                              </button>
                            </div>
                          ))}
                          {pendingExperts.length === 0 && <EmptyState text="No profiles waiting for review." />}
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-white/[0.03]">
                        <SectionHeader title="Open Complaints" action={<button onClick={() => setActiveTab("reports")} className="text-xs font-bold text-primary-300">Open Reports</button>} />
                        <div className="divide-y divide-white/5">
                          {openReports.slice(0, 3).map((report) => (
                            <div key={report._id} className="p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-bold text-white">{report.name}</p>
                                <span className="text-[11px] text-slate-500">{formatDate(report.createdAt)}</span>
                              </div>
                              <p className="mt-2 text-sm text-slate-400">{report.message}</p>
                            </div>
                          ))}
                          {openReports.length === 0 && <EmptyState text="No open complaints." />}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <AdminLink to="/manage-projects" title="Projects Desk" text="Review project content" />
                    <AdminLink to="/blog" title="Articles Desk" text="Open publication area" />
                    <AdminLink to="/messages" title="Message Inbox" text="View full message module" />
                  </div>
                </section>
              )}

              {activeTab === "users" && (
                <section className="space-y-6">
                  <Toolbar title="Manage Users" value={userSearch} onChange={setUserSearch} placeholder="Search name, email, role, status..." />
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1180px] text-left text-sm">
                        <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="p-4">Avatar / Photo</th>
                            <th className="p-4">User</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Verification</th>
                            <th className="p-4">Access</th>
                            <th className="p-4">Joined</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {filteredUsers.map((user) => (
                            <tr key={user._id} className="hover:bg-white/[0.03]">
                              <td className="p-4 align-top">
                                <UserAvatar user={user} />
                              </td>
                              <td className="p-4 align-top">
                                <div className="min-w-0">
                                  <p className="font-bold text-white">{user.name || "Unknown user"}</p>
                                  <p className="mt-1 truncate text-xs text-slate-500">{user.email || "No email"}</p>
                                </div>
                              </td>
                              <td className="p-4 align-top">
                                <StatusBadge status={getRoleKey(user)}>{getRoleLabel(user)}</StatusBadge>
                              </td>
                              <td className="p-4">
                                <StatusBadge status={user.isEmailVerified ? "paid" : "pending"}>
                                  {user.isEmailVerified ? "Verified" : "Unverified"}
                                </StatusBadge>
                              </td>
                              <td className="p-4">
                                <StatusBadge status={user.isBlocked ? "cancelled" : "completed"}>
                                  {user.isBlocked ? "Blocked" : "Active"}
                                </StatusBadge>
                              </td>
                              <td className="p-4 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                              <td className="p-4">
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <ActionButton onClick={() => handleViewProfile(user)}>
                                      View Profile
                                    </ActionButton>
                                    <ActionButton onClick={() => handleToggleVerify(user._id, user.isEmailVerified)}>
                                      {user.isEmailVerified ? "Unverify" : "Verify"}
                                    </ActionButton>
                                    {getRoleKey(user) !== "admin" && (
                                      <>
                                        <ActionButton tone={user.isBlocked ? "green" : "amber"} onClick={() => handleToggleBlock(user._id, user.isBlocked)}>
                                          {user.isBlocked ? "Unblock" : "Block"}
                                        </ActionButton>
                                        <ActionButton tone="red" onClick={() => handleDeleteUser(user._id)}>
                                          Delete
                                        </ActionButton>
                                      </>
                                    )}
                                  </div>

                                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Assign Role</p>
                                      <span className="text-[10px] text-slate-600">Separate from displayed role</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <select
                                        value={roleDrafts[user._id] ?? user.role}
                                        onChange={(event) => setRoleDrafts((current) => ({ ...current, [user._id]: event.target.value }))}
                                        disabled={getRoleKey(user) === "admin"}
                                        className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold capitalize text-white outline-none transition focus:border-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <option value="client">Client</option>
                                        <option value="expert">Faculty</option>
                                        <option value="admin">Super Admin</option>
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => handleRoleChange(user._id)}
                                        disabled={getRoleKey(user) === "admin"}
                                        className="rounded-md border border-primary-400/20 bg-primary-500/15 px-3 py-2 text-xs font-bold text-primary-200 transition hover:bg-primary-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        Assign
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredUsers.length === 0 && <EmptyState text="No users match this search." />}
                  </div>
                </section>
              )}

              {activeTab === "profiles" && (
                <section className="space-y-6">
                  <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
                    <h2 className="text-2xl font-bold text-white">Block/Verify Profiles</h2>
                    <p className="text-sm text-slate-400">Approve expert profiles, verify emails, and block risky accounts.</p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {experts.map((expert) => (
                      <div key={expert._id} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <UserMini user={expert} large />
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <StatusBadge status={expert.isApproved ? "completed" : "pending"}>
                              {expert.isApproved ? "Approved" : "Pending"}
                            </StatusBadge>
                            <StatusBadge status={expert.isBlocked ? "cancelled" : "confirmed"}>
                              {expert.isBlocked ? "Blocked" : "Active"}
                            </StatusBadge>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 rounded-lg border border-white/5 bg-black/10 p-4 text-xs text-slate-400 sm:grid-cols-3">
                          <ProfileStat label="Rate" value={formatMoney(expert.hourlyRate || 0)} />
                          <ProfileStat label="Category" value={expert.category || "General"} />
                          <ProfileStat label="Rating" value={`${expert.rating || 0} / 5`} />
                        </div>

                        <p className="mt-4 text-sm leading-6 text-slate-400">{expert.bio || "No profile bio submitted yet."}</p>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <ActionButton tone={expert.isApproved ? "amber" : "green"} onClick={() => handleToggleApproval(expert._id, expert.isApproved)}>
                            {expert.isApproved ? "Suspend Approval" : "Approve Profile"}
                          </ActionButton>
                          <ActionButton onClick={() => handleToggleVerify(expert._id, expert.isEmailVerified)}>
                            {expert.isEmailVerified ? "Mark Unverified" : "Verify Email"}
                          </ActionButton>
                          <ActionButton tone={expert.isBlocked ? "green" : "red"} onClick={() => handleToggleBlock(expert._id, expert.isBlocked)}>
                            {expert.isBlocked ? "Unblock" : "Block"}
                          </ActionButton>
                        </div>
                      </div>
                    ))}
                  </div>
                  {experts.length === 0 && <EmptyState text="No expert profiles found." />}
                </section>
              )}

              {activeTab === "revenue" && (
                <section className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard label="Gross Revenue" value={formatMoney(metrics.totalRevenue || revenueFromPaidBookings)} note={`${metrics.totalPaidBookings || payments.length} paid bookings`} tone="emerald" />
                    <MetricCard label="Platform Commission Earned" value={formatMoney(metrics.platformCommissionEarned || 0)} note={`${metrics.commissionPercent || adminSettings.commissionPercent || 20}% commission`} />
                    <MetricCard label="Expert Earnings Pending" value={formatMoney(metrics.expertEarningsPending || 0)} note="Not marked paid yet" tone="amber" />
                    <MetricCard label="Paid Out" value={formatMoney(metrics.paidOut || 0)} note="Manual expert transfers" tone="emerald" />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                      <h3 className="text-lg font-bold text-white">Booking Status Mix</h3>
                      <div className="mt-5 space-y-4">
                        {bookingStatuses.map((status) => (
                          <ProgressRow
                            key={status}
                            label={status}
                            value={metrics.bookingStatusCounts?.[status] || 0}
                            total={metrics.totalBookings || bookings.length || 1}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
                      <Toolbar title="Revenue Ledger" value={paymentSearch} onChange={setPaymentSearch} placeholder="Search transactions..." compact />
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                            <tr>
                              <th className="p-4">Client</th>
                              <th className="p-4">Expert</th>
                              <th className="p-4">Payment ID</th>
                              <th className="p-4">Gross</th>
                              <th className="p-4">Commission</th>
                              <th className="p-4">Expert Earning</th>
                              <th className="p-4">Payout</th>
                              <th className="p-4">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-slate-300">
                            {filteredPayments.map((payment) => (
                              <tr key={payment._id} className="hover:bg-white/[0.03]">
                                <td className="p-4 font-bold text-white">{payment.client?.name || "Deleted user"}</td>
                                <td className="p-4">{payment.expert?.name || "Expert"}</td>
                                <td className="p-4 font-mono text-xs text-primary-300">{payment.paymentId || "demo_payment"}</td>
                                <td className="p-4 font-bold text-white">{formatMoney(payment.grossAmount || payment.totalPrice)}</td>
                                <td className="p-4">{formatMoney(payment.platformCommission ?? ((payment.grossAmount || payment.totalPrice || 0) * (payment.commissionPercent || metrics.commissionPercent || 20) / 100))}</td>
                                <td className="p-4">{formatMoney(payment.expertEarning ?? ((payment.grossAmount || payment.totalPrice || 0) - ((payment.grossAmount || payment.totalPrice || 0) * (payment.commissionPercent || metrics.commissionPercent || 20) / 100)))}</td>
                                <td className="p-4"><StatusBadge status={payment.payoutStatus || "pending"}>{payment.payoutStatus || "pending"}</StatusBadge></td>
                                <td className="p-4 text-xs text-slate-500">{formatDate(payment.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {filteredPayments.length === 0 && <EmptyState text="No payment records found." />}
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "payouts" && (
                <section className="space-y-6">
                  <Toolbar title="Payout Management" value={payoutSearch} onChange={setPayoutSearch} placeholder="Search expert, method, status, account..." />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleDownloadPayoutReport}
                      disabled={downloadingPayoutReport}
                      className="rounded-lg border border-primary-400/20 bg-primary-500/15 px-4 py-2 text-xs font-bold text-primary-200 transition hover:bg-primary-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {downloadingPayoutReport ? "Preparing CSV..." : "Download Payout Report"}
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard label="Pending Requests" value={payouts.filter((payout) => payout.status === "pending").length} note="Waiting for review" tone="amber" />
                    <MetricCard label="Approved" value={payouts.filter((payout) => payout.status === "approved").length} note="Ready to pay" />
                    <MetricCard label="Paid Out" value={formatMoney(payouts.filter((payout) => payout.status === "paid").reduce((sum, payout) => sum + (Number(payout.amount) || 0), 0))} note="Manual transfers marked paid" tone="emerald" />
                    <MetricCard label="Rejected" value={payouts.filter((payout) => payout.status === "rejected").length} note="Declined requests" tone="red" />
                  </div>

                  <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1120px] text-left text-sm">
                        <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="p-4">Expert</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4">Wallet Snapshot</th>
                            <th className="p-4">Payout Details</th>
                            <th className="p-4">Requested</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {filteredPayouts.map((payout) => {
                            const details = payout.payoutDetails || {};
                            return (
                              <tr key={payout._id} className="hover:bg-white/[0.03]">
                                <td className="p-4"><UserMini user={payout.expert} /></td>
                                <td className="p-4">
                                  <p className="font-bold text-white">{formatMoney(payout.amount || payout.netAmount)}</p>
                                  <p className="mt-1 text-xs text-slate-500">{payout.platformCommissionPercent || 20}% commission already deducted</p>
                                </td>
                                <td className="p-4 text-xs text-slate-400">
                                  <p>Total earned: <span className="font-bold text-slate-200">{formatMoney(payout.totalEarningsAtRequest || payout.netAmount)}</span></p>
                                  <p>Available: <span className="font-bold text-slate-200">{formatMoney(payout.availableBalanceAtRequest || payout.amount)}</span></p>
                                  <p>Paid out: <span className="font-bold text-slate-200">{formatMoney(payout.paidOutAtRequest || 0)}</span></p>
                                </td>
                                <td className="p-4 text-xs text-slate-400">
                                  <p className="font-bold uppercase text-primary-300">{details.payoutMethod || payout.payoutMethod || "upi"}</p>
                                  <p>{details.accountHolderName || payout.expert?.accountHolderName || "No account holder"}</p>
                                  {(details.payoutMethod || payout.payoutMethod) === "bank" ? (
                                    <>
                                      <p className="font-mono">{details.bankAccountNumber || payout.expert?.bankDetails?.accountNumber || "No account number"}</p>
                                      <p className="font-mono">{details.ifscCode || payout.expert?.bankDetails?.ifsc || "No IFSC"}</p>
                                    </>
                                  ) : (
                                    <p className="font-mono">{details.upiId || payout.expert?.upiId || "No UPI ID"}</p>
                                  )}
                                </td>
                                <td className="p-4 text-xs text-slate-500">{formatDate(payout.createdAt)}</td>
                                <td className="p-4"><StatusBadge status={payout.status}>{payout.status}</StatusBadge></td>
                                <td className="p-4">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    {payout.status !== "approved" && payout.status !== "paid" && (
                                      <ActionButton tone="green" onClick={() => handlePayoutUpdate(payout._id, "approved")}>
                                        Approve
                                      </ActionButton>
                                    )}
                                    {payout.status !== "paid" && payout.status !== "rejected" && (
                                      <ActionButton tone="green" onClick={() => handlePayoutUpdate(payout._id, "paid")}>
                                        Mark Paid
                                      </ActionButton>
                                    )}
                                    {payout.status !== "rejected" && payout.status !== "paid" && (
                                      <ActionButton tone="red" onClick={() => handlePayoutUpdate(payout._id, "rejected")}>
                                        Reject
                                      </ActionButton>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {filteredPayouts.length === 0 && <EmptyState text="No payout requests found." />}
                  </div>
                </section>
              )}

              {activeTab === "settings" && (
                <section className="space-y-6">
                  <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
                    <h2 className="text-2xl font-bold text-white">Admin Settings</h2>
                    <p className="text-sm text-slate-400">Set the platform commission applied to future successful booking payments.</p>
                  </div>

                  <form onSubmit={handleSaveSettings} className="max-w-xl rounded-lg border border-white/10 bg-white/[0.03] p-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Commission Percentage</label>
                      <div className="flex gap-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={commissionPercent}
                          onChange={(event) => setCommissionPercent(event.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-400"
                        />
                        <button
                          type="submit"
                          disabled={savingSettings}
                          className="rounded-lg bg-primary-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingSettings ? "Saving..." : "Save"}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">Current default is {adminSettings.commissionPercent ?? 20}%.</p>
                    </div>
                  </form>
                </section>
              )}

              {activeTab === "reports" && (
                <section className="space-y-6">
                  <Toolbar title="Reports & Complaints" value={reportSearch} onChange={setReportSearch} placeholder="Search complaints..." />
                  <div className="grid gap-4">
                    {filteredReports.map((report) => (
                      <div key={report._id} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-lg font-bold text-white">{report.name}</h3>
                              <StatusBadge status={report.isRead ? "completed" : "pending"}>
                                {report.isRead ? "Resolved" : "Open"}
                              </StatusBadge>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{report.email} - {formatDate(report.createdAt)}</p>
                          </div>
                          <div className="flex gap-2">
                            <ActionButton tone={report.isRead ? "amber" : "green"} onClick={() => handleToggleReport(report._id, report.isRead)}>
                              {report.isRead ? "Reopen" : "Resolve"}
                            </ActionButton>
                            <ActionButton tone="red" onClick={() => handleDeleteReport(report._id)}>
                              Delete
                            </ActionButton>
                          </div>
                        </div>
                        <p className="mt-4 rounded-lg border border-white/5 bg-black/10 p-4 text-sm leading-6 text-slate-300">{report.message}</p>
                      </div>
                    ))}
                    {filteredReports.length === 0 && <EmptyState text="No reports or complaints found." />}
                  </div>
                </section>
              )}

              {activeTab === "bookings" && (
                <section className="space-y-6">
                  <Toolbar title="Booking Management" value={bookingSearch} onChange={setBookingSearch} placeholder="Search client, expert, status, payment..." />
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1050px] text-left text-sm">
                        <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="p-4">Client</th>
                            <th className="p-4">Expert</th>
                            <th className="p-4">Schedule</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4">Booking Status</th>
                            <th className="p-4">Payment</th>
                            <th className="p-4">Room</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {filteredBookings.map((booking) => (
                              <tr key={booking._id}>
                              <td className="p-4"><UserMini user={booking.client} /></td>
                              <td className="p-4"><UserMini user={booking.expert} /></td>
                              <td className="p-4">
                                <p className="font-bold text-white">{formatDate(booking.date)}</p>
                                <p className="text-xs text-slate-500">{booking.duration} min session</p>
                              </td>
                              <td className="p-4 font-bold text-white">{formatMoney(booking.totalPrice)}</td>
                              <td className="p-4">
                                <SelectField
                                  value={booking.status}
                                  options={bookingStatuses}
                                  onChange={(value) => handleBookingUpdate(booking._id, "status", value)}
                                />
                              </td>
                              <td className="p-4">
                                <SelectField
                                  value={booking.paymentStatus}
                                  options={paymentStatuses}
                                  onChange={(value) => handleBookingUpdate(booking._id, "paymentStatus", value)}
                                />
                              </td>
                              <td className="p-4">
                                {booking.meetingLink ? (
                                  <Link to={booking.meetingLink} className="text-xs font-bold text-primary-300 hover:text-primary-200">
                                    Open Room
                                  </Link>
                                ) : (
                                  <span className="text-xs text-slate-600">No room</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredBookings.length === 0 && <EmptyState text="No bookings match this search." />}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      {profileModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 px-4 py-8 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl">
            <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-r from-primary-500 via-violet-500 to-emerald-400" />
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Profile Details</p>
                <h2 className="mt-1 text-2xl font-extrabold text-white">Faculty / User Profile</h2>
              </div>
              <button
                type="button"
                onClick={closeProfileModal}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-6">
              {profileLoading ? (
                <div className="flex min-h-80 items-center justify-center">
                  <div className="h-12 w-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                  <aside className="space-y-5">
                    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 text-center">
                      <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-white/10 bg-white/5">
                        <ProfileAvatar
                          user={profileData}
                          src={profileAvatar}
                          className="h-full w-full"
                          imageClassName="h-full w-full object-cover"
                          fallbackClassName="flex h-full w-full items-center justify-center bg-primary-500/15 text-4xl font-extrabold text-primary-300"
                        />
                      </div>
                      <h3 className="mt-5 text-2xl font-extrabold text-white">{profileData.name || "Unknown User"}</h3>
                      <p className="mt-1 text-sm text-slate-400">{profileData.email || "No email"}</p>
                      <div className="mt-4 flex justify-center">
                        <StatusBadge status={getRoleKey(profileData)}>{getRoleLabel(profileData)}</StatusBadge>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                      <MetricCard label="Publications" value={profileCounts.publications} note="User profile count" />
                      <MetricCard label="Projects" value={profileCounts.projects} note="Linked portfolio works" />
                      <MetricCard label="Patents" value={profileCounts.patents} note="Recorded patent count" />
                    </div>
                  </aside>

                  <section className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <InfoCard label="Department" value={profileData.department || "Not set"} />
                        <InfoCard label="Designation" value={profileData.designation || "Not set"} />
                        <InfoCard label="Qualification" value={profileData.qualification || "Not set"} />
                        <InfoCard label="Role" value={getRoleLabel(profileData)} />
                        <InfoCard label="Status" value={profileData.isBlocked ? "Blocked" : "Active"} />
                        <InfoCard label="Verified" value={profileData.isEmailVerified ? "Email verified" : "Email not verified"} />
                      </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Research Interests</p>
                      {profileResearchInterests.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {profileResearchInterests.map((interest) => (
                            <span key={interest} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200">
                              {interest}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">No research interests recorded.</p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <InfoCard label="Google Scholar" value={profileData.googleScholarId || "Not set"} />
                      <InfoCard label="ORCID" value={profileData.orcidId || "Not set"} />
                      <InfoCard label="Scopus ID" value={profileData.scopusId || "Not set"} />
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Additional Details</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <InfoCard label="Bio" value={profileData.bio || "No bio provided"} />
                        <InfoCard label="Location" value={profileData.location || "Not set"} />
                        <InfoCard label="Experience" value={profileData.experience || "Not set"} />
                        <InfoCard label="Joined" value={formatDate(profileData.createdAt)} />
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

const MetricCard = ({ label, value, note, tone = "primary" }) => {
  const toneClass = {
    primary: "text-primary-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    red: "text-red-300",
  }[tone];

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-extrabold ${toneClass}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-400">{note}</p>
    </div>
  );
};

const SectionHeader = ({ title, action }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
    <h2 className="text-lg font-bold text-white">{title}</h2>
    {action}
  </div>
);

const Toolbar = ({ title, value, onChange, placeholder, compact = false }) => (
  <div className={`flex flex-col gap-3 ${compact ? "border-b border-white/10 p-4" : "border-b border-white/10 pb-4"} sm:flex-row sm:items-center sm:justify-between`}>
    <h2 className="text-2xl font-bold text-white">{title}</h2>
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-primary-400 sm:max-w-xs"
    />
  </div>
);

const UserMini = ({ user = {}, large = false }) => {
  const safeUser = user || {};

  return (
    <div className={`flex min-w-0 items-center gap-3 ${large ? "items-start" : ""}`}>
      <ProfileAvatar
        user={safeUser}
        className={`${large ? "h-14 w-14" : "h-10 w-10"} shrink-0 rounded-lg border border-white/10`}
        imageClassName="h-full w-full rounded-lg object-cover"
        fallbackClassName={`${large ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm"} flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-primary-500/15 font-bold text-primary-200`}
      />
      <div className="min-w-0">
        <p className="truncate font-bold text-white">{safeUser.name || "Unknown user"}</p>
        <p className="truncate text-xs text-slate-500">{safeUser.email || safeUser.title || "No email"}</p>
      </div>
    </div>
  );
};

const UserAvatar = ({ user = {} }) => {
  return (
    <ProfileAvatar
      user={user}
      className="h-12 w-12 rounded-2xl border border-white/10"
      imageClassName="h-full w-full rounded-2xl object-cover"
      fallbackClassName="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-primary-500/15 font-bold text-primary-200"
    />
  );
};

const ActionButton = ({ children, onClick, tone = "primary" }) => {
  const toneClass = {
    primary: "border-primary-400/20 bg-primary-500/15 text-primary-200 hover:bg-primary-500/25",
    green: "border-emerald-400/20 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25",
    amber: "border-amber-400/20 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25",
    red: "border-red-400/20 bg-red-500/15 text-red-200 hover:bg-red-500/25",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-xs font-bold transition ${toneClass}`}
    >
      {children}
    </button>
  );
};

const SelectField = ({ value, options, onChange }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="w-full rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold capitalize text-white outline-none transition focus:border-primary-400"
  >
    {options.map((option) => (
      <option key={option} value={option}>{option}</option>
    ))}
  </select>
);

const ProfileStat = ({ label, value }) => (
  <div>
    <p className="font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 truncate font-bold text-white">{value}</p>
  </div>
);

const InfoCard = ({ label, value }) => (
  <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">{label}</p>
    <p className="mt-2 break-words text-sm font-semibold text-white">{value}</p>
  </div>
);

const ProgressRow = ({ label, value, total }) => {
  const percent = Math.round((value / Math.max(total, 1)) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-bold capitalize text-slate-300">{label}</span>
        <span className="text-slate-500">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const AdminLink = ({ to, title, text }) => (
  <Link to={to} className="rounded-lg border border-white/10 bg-white/[0.03] p-5 transition hover:border-primary-400/30 hover:bg-white/[0.05]">
    <h3 className="text-lg font-bold text-white">{title}</h3>
    <p className="mt-2 text-sm text-slate-400">{text}</p>
  </Link>
);

const EmptyState = ({ text }) => (
  <div className="p-8 text-center text-sm text-slate-500">{text}</div>
);

export default Admin;
