import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

const sections = [
  {
    title: "Eligibility",
    body: "Refund requests may be reviewed for duplicate charges, failed services, or booking issues that were not resolved.",
  },
  {
    title: "Processing",
    body: "Approved refunds are processed through the original payment method whenever possible and may take several business days to appear.",
  },
  {
    title: "Non-Refundable Cases",
    body: "Completed consultation sessions and services delivered as promised may not be refundable unless required by law or policy.",
  },
];

const Refund = () => {
  return (
    <div className="min-h-screen bg-surface">
      <SEO
        title="Refund Policy"
        description="Read the refund policy for bookings, payments, and consultation sessions on Muskan Portfolio."
      />
      <Navbar />
      <main className="section-padding pt-40 pb-24">
        <div className="max-w-4xl mx-auto">
          <span className="inline-flex px-3 py-1 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-300 text-xs font-extrabold uppercase tracking-wider">
            Legal
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold text-white">Refund Policy</h1>
          <p className="mt-4 text-slate-400 text-lg max-w-3xl">
            This page explains how refunds are handled for bookings, payment disputes, and platform purchases.
          </p>

          <div className="mt-10 space-y-6">
            {sections.map((section) => (
              <section key={section.title} className="glass rounded-[2rem] border-white/5 p-6">
                <h2 className="text-2xl font-bold text-white">{section.title}</h2>
                <p className="mt-3 text-slate-400 leading-relaxed">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Refund;
