import axios from "axios";
import toast from "react-hot-toast";

const PaymentButton = ({ bookingData, onSuccess }) => {
  const handlePayment = async () => {
    try {
      const token = localStorage.getItem("token");
      
      // 1. Create Order on Backend
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/bookings/create-order`,
        bookingData,
        { headers: { Authorization: token } }
      );

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Use environment variable
        amount: data.amount,
        currency: data.currency,
        name: "Expert Booking",
        description: `Booking with Expert`,
        order_id: data.orderId,
        handler: async function (response) {
          try {
            // 2. Verify Payment on Backend
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
          }
        },
        prefill: {
          name: "User Name",
          email: "user@example.com",
        },
        theme: {
          color: "#6366f1",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error(error);
      toast.error("Error initiating payment");
    }
  };

  return (
    <button
      onClick={handlePayment}
      className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary-500/20 transition-all active:scale-95"
    >
      Pay & Confirm Booking
    </button>
  );
};

export default PaymentButton;
