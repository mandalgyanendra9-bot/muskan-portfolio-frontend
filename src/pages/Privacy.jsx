import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

const sections = [
  {
    title: "Information We Collect",
    body: "We collect account details, booking information, payment records, session activity, and support messages needed to deliver consultations and secure private sessions.",
  },
  {
    title: "How We Use Information",
    body: "We use your data to manage bookings, process payments, provide expert consultations, improve the platform, and keep private sessions secure.",
  },
  {
    title: "Private Sessions",
    body: "Protected sessions may use watermarks, signed media links, and violation logging to reduce leaks, screenshots, and unauthorized sharing.",
  },
];

const Privacy = () => {
  return (
    <div className="min-h-screen bg-surface">
      <SEO
        title="Privacy Policy"
        description="Learn how Muskan Portfolio handles account details, bookings, payments, and secure private sessions."
      />
      <Navbar />
      <main className="section-padding pt-40 pb-24">
        <div className="max-w-4xl mx-auto">
          <span className="inline-flex px-3 py-1 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-300 text-xs font-extrabold uppercase tracking-wider">
            Legal
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold text-white">Privacy Policy</h1>
          <p className="mt-4 text-slate-400 text-lg max-w-3xl">
            This policy explains how we handle data for bookings, payments, consultations, live sessions, and private media.
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

export default Privacy;
