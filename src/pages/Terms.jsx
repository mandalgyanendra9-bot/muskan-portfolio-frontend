import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

const sections = [
  {
    title: "Platform Use",
    body: "Use the platform for lawful booking, consultation, content sharing, and communication only.",
  },
  {
    title: "Payments and Bookings",
    body: "Bookings are confirmed according to the platform's payment and scheduling rules. Chargebacks, cancellations, and refunds may be subject to review.",
  },
  {
    title: "Prohibited Behavior",
    body: "Users may not misuse content, scrape the platform, bypass protection controls, or share private session material without permission.",
  },
];

const Terms = () => {
  return (
    <div className="min-h-screen bg-surface">
      <SEO
        title="Terms of Service"
        description="Read the terms for booking consultations, using payments, and participating in secure sessions."
      />
      <Navbar />
      <main className="section-padding pt-40 pb-24">
        <div className="max-w-4xl mx-auto">
          <span className="inline-flex px-3 py-1 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-300 text-xs font-extrabold uppercase tracking-wider">
            Legal
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold text-white">Terms of Service</h1>
          <p className="mt-4 text-slate-400 text-lg max-w-3xl">
            These terms govern your use of the Muskan Portfolio platform, including expert consultations, booking flow, and secure sessions.
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

export default Terms;
