import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import BookingJoinAction from "../components/BookingJoinAction";
import { formatBookingRange, getBookingDurationMinutes, getBookingJoinState, stampBookingReceivedAt } from "../utils/bookingTime";

const API_URL = import.meta.env.VITE_API_URL || "";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatMoney = (value = 0) => money.format(Number(value) || 0);

const normalizeBookingPayload = (payload) => {
  const booking = payload?.booking || payload;
  if (!booking) return null;
  return stampBookingReceivedAt({
    ...booking,
    callAccess: payload?.callAccess || booking.callAccess,
    serverNow: payload?.callAccess?.serverNow || booking.serverNow,
  });
};

const BookingDetails = () => {
  const { bookingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuccessPage = location.pathname.startsWith("/booking-success");

  const [booking, setBooking] = useState(() => normalizeBookingPayload(location.state?.booking));
  const [loading, setLoading] = useState(!location.state?.booking);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchBooking = useCallback(async ({ showLoading = false, quiet = false } = {}) => {
    try {
      const token = localStorage.getItem("token");
      if (!token || !bookingId) return;
      if (showLoading) setLoading(true);

      const { data } = await axios.get(`${API_URL}/api/bookings/${bookingId}`, {
        headers: { Authorization: token },
      });
      setBooking(normalizeBookingPayload(data));
    } catch (error) {
      if (!quiet) toast.error(error.response?.data?.message || "Unable to load booking");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return undefined;
    const timer = window.setTimeout(() => {
      void fetchBooking();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bookingId, fetchBooking]);

  const joinState = useMemo(() => getBookingJoinState(booking || {}, nowTick), [booking, nowTick]);
  const shouldPollBooking = Boolean(joinState.show && joinState.secondsUntilEnd !== null && joinState.secondsUntilEnd > 0);

  useEffect(() => {
    if (!shouldPollBooking) return undefined;

    const timer = window.setInterval(() => {
      void fetchBooking({ quiet: true });
    }, 20000);

    return () => window.clearInterval(timer);
  }, [fetchBooking, shouldPollBooking]);

  const handleJoin = () => {
    if (!booking?._id) return;
    navigate(`/video-call/${booking._id}`, { state: { booking } });
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

  if (!booking) {
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
          <p className="mt-3 text-slate-400">{formatBookingRange(booking)}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Status</p>
              <p className="mt-2 font-bold capitalize text-white">{booking.status}</p>
              <p className="text-xs capitalize text-slate-500">{booking.paymentStatus}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Duration</p>
              <p className="mt-2 font-bold text-white">{getBookingDurationMinutes(booking)} minutes</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Amount</p>
              <p className="mt-2 font-bold text-white">{formatMoney(booking.totalAmount || booking.totalPrice)}</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">Join window</p>
            <p className="mt-2 text-sm text-slate-300">
              {joinState.state === "early"
                ? joinState.label
                : joinState.state === "ended"
                  ? "This session has ended."
                  : joinState.canJoin
                    ? "The room is open now."
                    : "Join becomes available after successful payment confirmation."}
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <BookingJoinAction booking={booking} user={user} now={nowTick} onJoin={handleJoin} />
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
