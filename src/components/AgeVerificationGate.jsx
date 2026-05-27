const AgeVerificationGate = ({ onConfirm, onExit }) => {
  return (
    <main className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 px-4 py-8 flex items-center justify-center">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-sm p-6 sm:p-10 shadow-2xl">
        <p className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs sm:text-sm tracking-wide text-amber-300">
          18+ AGE RESTRICTED
        </p>

        <h1 className="mt-4 text-2xl sm:text-4xl font-bold leading-tight">
          Adult Content Warning
        </h1>

        <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
          This website contains adult content and is intended only for users
          who are 18 years of age or older (or the age of majority in your
          location). By entering, you confirm that you meet this requirement.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm sm:text-base font-semibold text-emerald-200 hover:bg-emerald-500/25 transition"
          >
            I am 18 or older - Enter site
          </button>
          <button
            type="button"
            onClick={onExit}
            className="w-full rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm sm:text-base font-semibold text-rose-200 hover:bg-rose-500/25 transition"
          >
            I am under 18 - Exit
          </button>
        </div>
      </section>
    </main>
  );
};

export default AgeVerificationGate;
