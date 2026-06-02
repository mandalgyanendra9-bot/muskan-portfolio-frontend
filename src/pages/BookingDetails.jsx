import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import BookingJoinAction from "../components/BookingJoinAction";
import { useAuth } from "../context/AuthContext";
import {
  formatBookingRange,
  getBookingDurationMinutes,
  getBookingJoinState,
} from "../utils/bookingTime";

const API_URL = import.meta.env.VITE_API_URL || "";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatMoney = (value = 0) => money.format(Number(value) || 0);

const BookingDetails = () => {
  const { bookingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuccessPage = location.pathname.startsWith("/booking-success");

  const [booking, setBooking] = useState(location.state?.booking || null);
  const [callAccess, setCallAccess] = useState(location.state?.callAccess || location.state?.booking?.callAccess || null);
  const [loading, setLoading] = useState(!location.state?.booking);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get(`${API_URL}/api/bookings/${bookingId}`, {
          headers: { Authorization: token },
        });
        setBooking(data.booking);
        setCallAccess(data.callAccess || data.booking?.callAccess || null);
      } catch (error) {
        toast.error(error.response?.data?.message || "Unable to load booking");
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) fetchBooking();
  }, [bookingId]);

  const bookingWithAccess = useMemo(() => (
    booking ? { ...booking, callAccess: callAccess || booking.callAccess } : null
  ), [booking, callAccess]);
  const joinState = useMemo(
    () => getBookingJoinState(bookingWithAccess || {}, user, nowTick),
    [bookingWithAccess, nowTick, user]
  );

  const handleJoin = () => {
    if (!bookingWithAccess?._id) return;
    navigate(`/video-call/${bookingWithAccess._id}`, { state: { booking: bookingWithAccess } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface text-white">
        <Navbar />
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!bookingWithAccess) {
    return (
      <div className="min-h-screen bg-surface text-white">
        <Navbar />
        <main className="mx-auto max-w-3xl px-6 pt-32 text-center">
          <h1 className="text-3xl font-extrabold">Booking not found</h1>
          <button className="mt-6 rounded-2xl bg-primary-500 px-6 py-3 font-bold" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-white">
      <SEO title={isSuccessPage ? "Booking Confirmed" : "Booking Details"} description="Review your confirmed consultation booking and join window." />
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-32">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-300">
            {isSuccessPage ? "Payment successful" : "Booking details"}
          </p>
          <h1 className="mt-4 text-4xl font-extrabold">
            {isSuccessPage ? "Your consultation is confirmed" : "Consultation booking"}
          </h1>
          <p className="mt-3 text-slate-400">{formatBookingRange(bookingWithAccess)}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
              <p className="mt-2 font-bold capitalize text-white">{bookingWithAccess.status || bookingWithAccess.bookingStatus}</p>
              <p className="text-xs capitalize text-slate-500">{bookingWithAccess.paymentStatus}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Duration</p>
              <p className="mt-2 font-bold text-white">{getBookingDurationMinutes(bookingWithAccess)} minutes</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Amount</p>
              <p className="mt-2 font-bold text-white">{formatMoney(bookingWithAccess.totalAmount || bookingWithAccess.totalPrice)}</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Join window</p>
            <p className="mt-2 text-sm text-slate-300">
              {joinState.canJoin
                ? "The room is open now."
                : joinState.countdownLabel || joinState.joinReasonBlocked}
            </p>
            <div className="mt-4 grid gap-3 text-xs text-slate-500 md:grid-cols-2">
              <p>serverNow: {joinState.serverNow || "not provided"}</p>
              <p>startAt: {joinState.startAt || "not set"}</p>
              <p>endAt: {joinState.endAt || "not set"}</p>
              <p>joinStart: {joinState.joinStart || "not set"}</p>
              <p>joinEnd: {joinState.joinEnd || "not set"}</p>
              <p>canJoin: {String(joinState.canJoin)}</p>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <BookingJoinAction booking={bookingWithAccess} user={user} now={nowTick} onJoin={handleJoin} />
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-slate-300 transition hover:bg-white/10"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BookingDetails;
