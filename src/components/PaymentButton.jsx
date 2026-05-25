import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const RAZORPAY_SCRIPT_ID = "razorpay-checkout-js";
const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

const loadRazorpayCheckout = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve();
    return;
  }

  const existingScript = document.getElementById(RAZORPAY_SCRIPT_ID);
  if (existingScript) {
    existingScript.addEventListener("load", resolve, { once: true });
    existingScript.addEventListener("error", () => reject(new Error("Unable to load Razorpay Checkout")), { once: true });
    return;
  }

  const script = document.createElement("script");
  script.id = RAZORPAY_SCRIPT_ID;
  script.src = RAZORPAY_SCRIPT_URL;
  script.async = true;
  script.onload = resolve;
  script.onerror = () => reject(new Error("Unable to load Razorpay Checkout"));
  document.body.appendChild(script);
});

const PaymentButton = ({ bookingData, onSuccess }) => {
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    setProcessing(true);
    toast.loading("Opening Razorpay Checkout...", { id: "payment_status" });

    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/bookings/create-order`,
        bookingData,
        { headers: { Authorization: token } }
      );

      await loadRazorpayCheckout();

      const key = data.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!key) {
        throw new Error("Platform Razorpay key is missing");
      }

      const options = {
        key,
        amount: data.amount,
        currency: data.currency,
        name: "Expert Consulting",
        description: "Consultation Booking Session",
        order_id: data.orderId,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          paylater: true,
        },
        handler: async (response) => {
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
              toast.success("Payment successful. Booking confirmed.", { id: "payment_status" });
              onSuccess?.(verifyRes.data.booking);
            }
          } catch (err) {
            toast.error(err.response?.data?.message || "Payment verification failed", { id: "payment_status" });
          } finally {
            setProcessing(false);
          }
        },
        prefill: {
          name: bookingData?.clientName || "",
          email: bookingData?.clientEmail || "",
        },
        theme: {
          color: "#6366f1",
        },
        modal: {
          ondismiss: () => {
            toast.dismiss("payment_status");
            setProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        toast.error("Payment failed or cancelled", { id: "payment_status" });
        setProcessing(false);
      });
      rzp.open();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || "Error initiating payment checkout", {
        id: "payment_status",
      });
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
            <span>OPENING CHECKOUT...</span>
          </>
        ) : (
          <span>Pay & Confirm Booking</span>
        )}
      </button>

      <p className="mt-3 text-center text-xs text-slate-400">
        UPI, PhonePe, Google Pay, Paytm, Card, and Net Banking via Razorpay Checkout.
      </p>

      {processing && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[300] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
          <div className="w-20 h-20 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mb-6" />
          <h2 className="text-2xl font-black text-white tracking-wide">SECURE RAZORPAY CHECKOUT</h2>
          <p className="text-slate-400 text-sm max-w-sm mt-2 leading-relaxed">
            Please complete payment in Razorpay Checkout. Your booking confirms only after payment is verified.
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentButton;
