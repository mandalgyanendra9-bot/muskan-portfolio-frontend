import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";

const PLANS = [
  { id: "free", name: "Free", price: 0, benefits: ["Basic Profile", "Standard Support"] },
  { id: "pro", name: "Pro Plan", price: 999, benefits: ["Featured Listing", "Priority Support", "0% Commission"] },
  { id: "premium", name: "Premium VIP", price: 1999, benefits: ["VIP Membership Badge", "Priority Booking Queue", "Exclusive Content Access", "Followers & Subscribers Growth Tools"] },
];

const PREMIUM_FEATURES = [
  {
    title: "VIP Membership",
    description: "Show a premium badge across your profile and billing area.",
  },
  {
    title: "Priority Booking",
    description: "Premium client bookings are moved to the top of the expert queue.",
  },
  {
    title: "Exclusive Content",
    description: "Publish locked profile updates that only subscribers can read.",
  },
  {
    title: "Followers / Subscribers",
    description: "Track real audience growth from follows and content subscriptions.",
  },
];

const Billing = () => {
  const { user, updateUser } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [amountInput, setAmountInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [withdrawBank, setWithdrawBank] = useState({ accountNumber: "", ifsc: "", bankName: "" });
  const [showWithdraw, setShowWithdraw] = useState(false);
  const followersCount = user?.followers?.length || 0;
  const subscribersCount = user?.subscribers?.length || 0;
  const isPremium = user?.subscriptionPlan === "premium";

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.get("/payments/history", { headers: { Authorization: token } });
      setHistory(res.data);
    } catch {
      toast.error("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchHistory();
    }, 0);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => window.clearTimeout(timer);
  }, []);

  const handleRazorpayPayment = async (amount, type, description) => {
    if (!amount || amount <= 0) return toast.error("Invalid amount");
    setProcessing(true);
    try {
      const token = localStorage.getItem("token");
      
      // 1. Create Order
      const { data: orderData } = await API.post(
        "/payments/create-order",
        { amount, type, description },
        { headers: { Authorization: token } }
      );

      // 2. Open Razorpay Checkout
      const razorpayKey = orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey) {
        throw new Error("Platform Razorpay key is missing");
      }

      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Muskan Portfolio Platform",
        description: description,
        order_id: orderData.orderId,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          paylater: true,
        },
        handler: async function (response) {
          try {
            // 3. Verify Payment
            const verifyRes = await API.post(
              "/payments/verify",
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                transactionId: orderData.transactionId,
              },
              { headers: { Authorization: token } }
            );
            updateUser(verifyRes.data.user);
            toast.success("Payment Successful! 🎉");
            fetchHistory();
            setAmountInput("");
          } catch {
            toast.error("Payment verification failed");
          } finally {
            setProcessing(false);
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: { color: "#6366f1" },
        modal: {
          ondismiss: () => setProcessing(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function () {
        toast.error("Payment Failed or Cancelled");
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to initiate payment");
      setProcessing(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!amountInput || amountInput < 100) return toast.error("Minimum withdrawal is ₹100");
    if (!withdrawBank.accountNumber || !withdrawBank.ifsc) return toast.error("Bank details required");
    
    setProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await API.post("/payments/withdraw", {
        amount: Number(amountInput),
        bankDetails: withdrawBank,
      }, { headers: { Authorization: token } });
      
      updateUser({ ...user, walletBalance: res.data.walletBalance });
      toast.success("Withdrawal request submitted successfully!");
      fetchHistory();
      setShowWithdraw(false);
      setAmountInput("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Withdrawal failed");
    } finally {
      setProcessing(false);
    }
  };

  const generateInvoice = (tx) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241); // Primary color
    doc.text("INVOICE", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Receipt No: ${tx._id}`, 14, 30);
    doc.text(`Date: ${new Date(tx.createdAt).toLocaleDateString()}`, 14, 35);
    
    // Billed To
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Billed To:", 14, 45);
    doc.setFontSize(10);
    doc.text(`Name: ${user.name}`, 14, 52);
    doc.text(`Email: ${user.email}`, 14, 57);

    // Table
    const tableData = [
      [tx.description || tx.type.replace("_", " ").toUpperCase(), "1", `Rs. ${tx.amount}`, `Rs. ${tx.amount}`]
    ];

    doc.autoTable({
      startY: 65,
      head: [["Description", "Quantity", "Unit Price", "Total"]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    // Total
    const finalY = doc.lastAutoTable.finalY || 65;
    doc.setFontSize(14);
    doc.text(`Total Amount: Rs. ${tx.amount}`, 140, finalY + 15);

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for your business!", 105, 280, { align: "center" });
    doc.text("Muskan Portfolio Platform", 105, 285, { align: "center" });

    doc.save(`Invoice_${tx._id}.pdf`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />
      <div className="flex-grow pt-28 pb-20 px-4 max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-white">Billing & Payments</h1>
          <p className="text-slate-400 mt-2">Manage your wallet, subscriptions, and download invoices.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Wallet Section */}
          <div className="glass p-8 rounded-[2rem] border-white/5 md:col-span-1 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white mb-2">My Wallet</h2>
              <p className="text-4xl font-extrabold text-emerald-400">₹{user?.walletBalance || 0}</p>
              <p className="text-slate-400 text-sm mt-1 mb-6">Available Balance</p>
            </div>

            <div className="space-y-4">
              {!showWithdraw ? (
                <>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Amount to add" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                      value={amountInput}
                      onChange={e => setAmountInput(e.target.value)}
                    />
                    <button 
                      onClick={() => handleRazorpayPayment(amountInput, "wallet_topup", "Wallet Top-up")}
                      disabled={processing || !amountInput}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl whitespace-nowrap disabled:opacity-50"
                    >
                      Add +
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleWithdraw} className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
                  <h3 className="text-sm font-bold text-white">Withdraw to Bank</h3>
                  <input type="number" placeholder="Amount (Min ₹100)" required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" value={amountInput} onChange={e => setAmountInput(e.target.value)} />
                  <input type="text" placeholder="Account Number" required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" value={withdrawBank.accountNumber} onChange={e => setWithdrawBank({...withdrawBank, accountNumber: e.target.value})} />
                  <input type="text" placeholder="IFSC Code" required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" value={withdrawBank.ifsc} onChange={e => setWithdrawBank({...withdrawBank, ifsc: e.target.value})} />
                  <input type="text" placeholder="Bank Name" required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" value={withdrawBank.bankName} onChange={e => setWithdrawBank({...withdrawBank, bankName: e.target.value})} />
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowWithdraw(false)} className="flex-1 bg-slate-700 text-white text-xs py-2 rounded-lg font-bold">Cancel</button>
                    <button type="submit" disabled={processing} className="flex-1 bg-emerald-500 text-white text-xs py-2 rounded-lg font-bold disabled:opacity-50">Confirm</button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Subscriptions Section */}
          <div className="glass p-8 rounded-[2rem] border-white/5 md:col-span-2">
            <h2 className="text-lg font-bold text-white mb-6">Subscription Plan</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {PLANS.map(plan => {
                const isActive = user?.subscriptionPlan === plan.id;
                return (
                  <div key={plan.id} className={`p-5 rounded-2xl border ${isActive ? 'bg-primary-500/10 border-primary-500/50 relative' : 'bg-white/5 border-white/10'}`}>
                    {isActive && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Active</span>}
                    <h3 className="font-bold text-white">{plan.name}</h3>
                    <p className="text-2xl font-extrabold text-primary-400 my-2">₹{plan.price}<span className="text-xs text-slate-400 font-normal">/mo</span></p>
                    <ul className="text-xs text-slate-400 space-y-2 mb-4">
                      {plan.benefits.map((b, i) => <li key={i}>✓ {b}</li>)}
                    </ul>
                    {plan.price > 0 && !isActive && (
                      <button 
                        onClick={() => handleRazorpayPayment(plan.price, "subscription", `${plan.name} Subscription`)}
                        disabled={processing}
                        className="w-full bg-white/10 hover:bg-primary-500 hover:text-white text-slate-300 font-bold py-2 rounded-xl transition-all text-sm disabled:opacity-50"
                      >
                        Upgrade
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {user?.subscriptionExpiresAt && (
              <p className="text-xs text-slate-400 mt-4 text-center">Your plan expires on: {new Date(user.subscriptionExpiresAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        <div className="glass p-8 rounded-[2rem] border-white/5 overflow-hidden relative">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            <div className="max-w-2xl">
              <span className="inline-flex px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                Premium Features
              </span>
              <h2 className="text-3xl font-extrabold text-white mt-4">VIP tools for bookings, content, and audience growth</h2>
              <p className="text-slate-400 mt-3 text-sm leading-relaxed">
                Build a real follower and subscriber base through profile follows, exclusive content, and premium booking visibility.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full lg:w-72">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Followers</p>
                <p className="text-3xl font-extrabold text-white mt-1">{followersCount}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Subscribers</p>
                <p className="text-3xl font-extrabold text-primary-400 mt-1">{subscribersCount}</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mt-8">
            {PREMIUM_FEATURES.map((feature) => (
              <div key={feature.title} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h3 className="text-white font-bold">{feature.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed mt-2">{feature.description}</p>
              </div>
            ))}
          </div>

          {!isPremium && (
            <button
              onClick={() => handleRazorpayPayment(1999, "subscription", "Premium VIP Subscription")}
              disabled={processing}
              className="mt-8 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold py-3 px-6 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
            >
              Upgrade to VIP Premium
            </button>
          )}
        </div>

        {/* Payment History */}
        <div className="glass p-8 rounded-[2rem] border-white/5">
          <h2 className="text-lg font-bold text-white mb-6">Payment History & Invoices</h2>
          {loading ? (
            <p className="text-slate-400">Loading history...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl">
              <p className="text-slate-500">No transactions found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-sm">
                    <th className="py-4 px-4 font-medium">Date</th>
                    <th className="py-4 px-4 font-medium">Description</th>
                    <th className="py-4 px-4 font-medium">Amount</th>
                    <th className="py-4 px-4 font-medium">Status</th>
                    <th className="py-4 px-4 font-medium text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {history.map((tx) => (
                    <tr key={tx._id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 text-slate-300">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td className="py-4 px-4 text-white font-medium capitalize">
                        {tx.description || tx.type.replace("_", " ")}
                      </td>
                      <td className={`py-4 px-4 font-bold ${tx.type === 'withdrawal' || tx.type === 'subscription' ? 'text-slate-300' : 'text-emerald-400'}`}>
                        {tx.type === 'withdrawal' || tx.type === 'subscription' ? '-' : '+'}₹{tx.amount}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          tx.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 
                          tx.status === 'processing' ? 'bg-yellow-500/10 text-yellow-400' : 
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {tx.status === "success" && (
                          <button 
                            onClick={() => generateInvoice(tx)}
                            className="text-primary-400 hover:text-primary-300 font-bold text-xs flex items-center justify-end gap-1 ml-auto"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
      <Footer />
    </div>
  );
};

export default Billing;
