import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const PaymentButton = ({ bookingData, onSuccess }) => {
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    setProcessing(true);
    try {
      const token = localStorage.getItem("token");
      
      // 1. Create Order on Backend
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/bookings/create-order`,
        bookingData,
        { headers: { Authorization: token } }
      );

      // 2. Handle Demo Fallback Payment
      if (data.isDemoMode) {
        toast.loading("Initiating secure sandbox checkout...", { id: "payment_status" });
        
        setTimeout(async () => {
          try {
            toast.loading("Processing transaction (Demo Sandbox Mode)...", { id: "payment_status" });
            
            // Wait 2.5s to simulate bank authentication
            setTimeout(async () => {
              try {
                const verifyRes = await axios.post(
                  `${import.meta.env.VITE_API_URL}/api/bookings/verify-payment`,
                  {
                    bookingId: data.booking._id,
                    isDemoMode: true
                  },
                  { headers: { Authorization: token } }
                );

                if (verifyRes.data.booking) {
                  toast.success("Sandbox Payment Successful! Booking Confirmed.", { id: "payment_status" });
                  if (onSuccess) onSuccess(verifyRes.data.booking);
                }
              } catch (err) {
                toast.error("Demo verification failed", { id: "payment_status" });
              } finally {
                setProcessing(false);
              }
            }, 2500);
            
          } catch (err) {
            toast.error("Demo checkout failed", { id: "payment_status" });
            setProcessing(false);
          }
        }, 1000);
        return;
      }

      // 3. Real Razorpay Integration
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: "Expert Consulting",
        description: `Consultation Booking Session`,
        order_id: data.orderId,
        handler: async function (response) {
          try {
            const verifyRes = await axios.post(
              `${import.meta.env.VITE_API_URL}/api/bookings/verify-payment`,
              {
                bookingId: data.booking._id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              { headers: { Authorization: token } }
            );

            if (verifyRes.data.booking) {
              toast.success("Payment Successful & Booking Confirmed!");
              if (onSuccess) onSuccess(verifyRes.data.booking);
            }
          } catch (err) {
            toast.error("Payment Verification Failed");
          } finally {
            setProcessing(false);
          }
        },
        prefill: {
          name: "User Client",
          email: "client@example.com",
        },
        theme: {
          color: "#6366f1",
        },
        modal: {
          ondismiss: function() {
            setProcessing(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error(error);
      toast.error("Error initiating payment checkout");
      setProcessing(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handlePayment}
        disabled={processing}
        className="w-full bg-gradient-to-r from-primary-500 to-accent hover:from-primary-600 hover:to-violet-600 disabled:from-slate-700 disabled:to-slate-800 text-white font-extrabold py-4.5 rounded-2xl shadow-xl shadow-primary-500/20 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-3"
      >
        {processing ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>SECURELY PROCESSING...</span>
          </>
        ) : (
          <span>Pay & Confirm Booking</span>
        )}
      </button>
      
      {processing && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[300] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
          <div className="w-20 h-20 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mb-6" />
          <h2 className="text-2xl font-black text-white tracking-wide">SECURE SANDBOX GATEWAY</h2>
          <p className="text-slate-400 text-sm max-w-sm mt-2 leading-relaxed">
            Please wait while we establish a secure sandbox connection, process credit tokenizers, and record ledger invoices.
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentButton;
