import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms governing access to and use of the AnatoLearn educational service.",
};

export default function TermsPage() {
  return (
    <article
      aria-labelledby="terms-title"
      className="rounded-2xl border border-border bg-surface p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-8 [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/30 [&_a]:underline-offset-4 hover:[&_a]:text-primary-hover [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_li]:leading-7 [&_p]:leading-7"
    >
      <header className="border-b border-border pb-7">
        <p className="text-sm font-semibold text-primary">AnatoLearn legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl" id="terms-title">
          Terms of Use
        </h1>
        <p className="mt-3 text-sm font-medium text-muted">Effective date: July 22, 2026</p>
      </header>

      <p className="mt-7 text-body">
        These Terms of Use govern your access to and use of AnatoLearn. By creating an account or using the service,
        you agree to these terms. If you do not agree, do not use AnatoLearn.
      </p>

      <section aria-labelledby="terms-education">
        <h2 id="terms-education">Educational service only</h2>
        <p className="mt-4 text-body">
          AnatoLearn provides anatomy learning content, flashcards, quizzes, tests, progress tools, and related
          educational features. It is not a substitute for professional medical education or advice, diagnosis,
          treatment, supervision, or clinical judgment. Do not rely on AnatoLearn to make medical or patient-care
          decisions. Verify important information with qualified educators, healthcare professionals, and current
          authoritative sources.
        </p>
      </section>

      <section aria-labelledby="terms-use">
        <h2 id="terms-use">Acceptable use</h2>
        <p className="mt-4 text-body">You may use AnatoLearn only for lawful educational purposes. You must not:</p>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-body marker:text-primary">
          <li>interfere with, overload, probe, or bypass the service or its security controls;</li>
          <li>access another person&apos;s account or restricted administrative features without permission;</li>
          <li>upload malicious, unlawful, infringing, deceptive, or privacy-violating material;</li>
          <li>scrape, copy, redistribute, or commercially exploit service content except as permitted by law; or</li>
          <li>use AnatoLearn to provide medical advice or misrepresent educational results as professional credentials.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-account">
        <h2 id="terms-account">Account security</h2>
        <p className="mt-4 text-body">
          Provide accurate account information, protect your password and devices, and promptly tell us if you suspect
          unauthorized access. You are responsible for activity performed through your account to the extent it
          results from your failure to use reasonable account security. We may require authentication or other checks
          before acting on an account request.
        </p>
      </section>

      <section aria-labelledby="terms-content">
        <h2 id="terms-content">Content and intellectual property</h2>
        <p className="mt-4 text-body">
          AnatoLearn and its learning materials, software, branding, and interface are owned by or licensed to the
          service operator and are protected by applicable intellectual property laws. We give you a limited,
          revocable, non-transferable right to use the service for personal educational purposes while these terms
          apply. This does not transfer ownership or permit unauthorized copying or redistribution.
        </p>
        <p className="mt-4 text-body">
          You must have the necessary rights to anything you submit. You authorize us to host and process submitted
          avatars, feedback, and attachments only as reasonably needed to operate, secure, and improve AnatoLearn.
        </p>
      </section>

      <section aria-labelledby="terms-availability">
        <h2 id="terms-availability">Availability and changes to the service</h2>
        <p className="mt-4 text-body">
          We may maintain, update, add, limit, or remove features and content. AnatoLearn may sometimes be interrupted,
          delayed, unavailable, or contain errors. We do not promise that every feature or item of content will remain
          available or that the service will always operate without interruption.
        </p>
      </section>

      <section aria-labelledby="terms-termination">
        <h2 id="terms-termination">Suspension and termination</h2>
        <p className="mt-4 text-body">
          You may stop using AnatoLearn at any time and may contact us about account deactivation or deletion. We may
          restrict, suspend, or terminate access when reasonably necessary to address a material violation of these
          terms, security or abuse concerns, legal requirements, or risks to other users or the service. Some records
          may be retained as described in the Privacy Policy.
        </p>
      </section>

      <section aria-labelledby="terms-disclaimers">
        <h2 id="terms-disclaimers">Disclaimers</h2>
        <p className="mt-4 text-body">
          To the extent permitted by applicable law, AnatoLearn is provided on an &quot;as is&quot; and &quot;as available&quot; basis
          without warranties of accuracy, completeness, fitness for a particular purpose, or uninterrupted operation.
          Educational content and assessment results may contain errors and should be independently verified. Nothing
          in these terms limits a warranty or right that cannot lawfully be excluded.
        </p>
      </section>

      <section aria-labelledby="terms-liability">
        <h2 id="terms-liability">Limitation of liability</h2>
        <p className="mt-4 text-body">
          To the extent permitted by applicable law, the AnatoLearn operator will not be liable for indirect,
          incidental, special, consequential, or punitive losses arising from use of or inability to use the service,
          reliance on educational content, loss of data, or unauthorized account access. This limitation does not
          exclude liability that cannot lawfully be limited or excluded.
        </p>
      </section>

      <section aria-labelledby="terms-changes">
        <h2 id="terms-changes">Changes to these terms</h2>
        <p className="mt-4 text-body">
          We may update these terms when the service or applicable requirements change. We will post the updated terms
          with a revised effective date. You should review changes before continuing to use AnatoLearn.
        </p>
      </section>

      <section aria-labelledby="terms-contact">
        <h2 id="terms-contact">Contact us</h2>
        <p className="mt-4 text-body">
          Questions about these terms can be sent to{" "}
          <a href="mailto:rajrabidas001@gmail.com">rajrabidas001@gmail.com</a>.
        </p>
      </section>
    </article>
  );
}
