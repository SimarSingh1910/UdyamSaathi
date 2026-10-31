const steps = [
  {
    title: "Tell us about your business",
    body: "Answer a few questions in your language. Our advisor recommends a bundle and explains why.",
  },
  {
    title: "See one clear monthly price",
    body: "Toggle add-ons on or off and watch the price update. No product codes, no hidden fees.",
  },
  {
    title: "Finish KYC in minutes",
    body: "We fetch your GST and Udyam details for you. Upload only what we cannot fetch.",
  },
  {
    title: "Track your order",
    body: "Check installation and activation status any time, without calling support.",
  },
];

export default function Home() {
  return (
    <main>
      <span className="badge">Accel Business</span>
      <h1>Get your business online in one sitting</h1>
      <p className="muted">
        Internet, business SIMs, WhatsApp, cloud email, security and CCTV: one bundle, one bill,
        one support number.
      </p>

      {steps.map((s, i) => (
        <section className="card step" key={s.title}>
          <span className="step-num">{i + 1}</span>
          <div>
            <h2>{s.title}</h2>
            <p className="muted">{s.body}</p>
          </div>
        </section>
      ))}
    </main>
  );
}
