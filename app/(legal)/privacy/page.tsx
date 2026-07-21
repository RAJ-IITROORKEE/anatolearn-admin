import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AnatoLearn collects, uses, shares, retains, and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <article
      aria-labelledby="privacy-title"
      className="rounded-2xl border border-border bg-surface p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-8 [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/30 [&_a]:underline-offset-4 hover:[&_a]:text-primary-hover [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_li]:leading-7 [&_p]:leading-7"
    >
      <header className="border-b border-border pb-7">
        <p className="text-sm font-semibold text-primary">AnatoLearn legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl" id="privacy-title">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm font-medium text-muted">Effective date: July 22, 2026</p>
      </header>

      <p className="mt-7 text-body">
        This Privacy Policy explains how AnatoLearn collects, uses, shares, and retains information when you use
        our anatomy learning service. AnatoLearn is an educational service. It is not a substitute for professional
        medical education or advice, diagnosis, or treatment.
      </p>

      <section aria-labelledby="privacy-collect">
        <h2 id="privacy-collect">Information we collect</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-body marker:text-primary">
          <li>
            <strong className="text-foreground">Account, profile, and avatar data:</strong> your name, email address,
            account status, authentication identifiers, profile details, and an avatar you choose to upload.
          </li>
          <li>
            <strong className="text-foreground">Learning progress:</strong> lesson completion, flashcard activity,
            mastery indicators, topic progress, and related learning history.
          </li>
          <li>
            <strong className="text-foreground">Assessments, answers, and scores:</strong> quiz and test attempts,
            selected answers, timing, scores, results, and retake history.
          </li>
          <li>
            <strong className="text-foreground">Feedback:</strong> feedback type, subject, message, rating, optional
            attachment, and our review or resolution status.
          </li>
          <li>
            <strong className="text-foreground">Notification and device data:</strong> notification records, read
            status, device platform, push notification token, and delivery status when notifications are enabled.
          </li>
          <li>
            <strong className="text-foreground">Security, audit, and technical data:</strong> sign-in and account
            security events, administrative audit records, request identifiers, timestamps, IP-derived security
            hashes, user agent, and diagnostic or rate-limiting data.
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy-use">
        <h2 id="privacy-use">How we use information</h2>
        <p className="mt-4 text-body">
          We use this information to create and secure accounts, provide learning content, save progress, operate
          assessments, calculate and display results, respond to feedback, deliver requested notifications, maintain
          the service, prevent abuse, investigate problems, and meet applicable legal obligations.
        </p>
      </section>

      <section aria-labelledby="privacy-auth-storage">
        <h2 id="privacy-auth-storage">Authentication and private storage</h2>
        <p className="mt-4 text-body">
          Supabase Auth provides authentication for AnatoLearn and processes the information needed to create and
          maintain secure sign-in sessions. Avatars and eligible uploaded files are stored in private storage.
          AnatoLearn uses controlled, time-limited access links when those private files need to be displayed.
        </p>
      </section>

      <section aria-labelledby="privacy-sharing">
        <h2 id="privacy-sharing">Service providers and sharing</h2>
        <p className="mt-4 text-body">
          We use service providers to operate AnatoLearn, including Supabase for authentication, database, and private
          storage services, and providers for hosting, security, rate limiting, and notification delivery where those
          features are configured. They process information on our behalf to provide those services. We may also
          disclose information when reasonably necessary to comply with law, protect users or the service, or address
          fraud and security concerns.
        </p>
        <p className="mt-4 rounded-xl border border-primary/20 bg-primary-soft p-4 text-body">
          We do not sell your personal information or provide it to third parties for their independent advertising.
          We do share information with service providers as described above so they can operate AnatoLearn for us.
        </p>
      </section>

      <section aria-labelledby="privacy-retention">
        <h2 id="privacy-retention">Retention and deletion</h2>
        <p className="mt-4 text-body">
          We retain information for as long as reasonably needed to provide and secure AnatoLearn, preserve learning
          and assessment records, resolve feedback, maintain audit integrity, and meet applicable obligations. The
          retention period depends on the type of information and why it is needed. Account deactivation may preserve
          learning, assessment, notification, security, and audit history.
        </p>
        <p className="mt-4 text-body">
          You may ask us to delete your account or personal information. We will evaluate the request subject to
          applicable law and legitimate security, record-integrity, and operational needs. Some records may not be
          deleted immediately or completely when retention is reasonably required.
        </p>
      </section>

      <section aria-labelledby="privacy-security">
        <h2 id="privacy-security">Security</h2>
        <p className="mt-4 text-body">
          We use administrative and technical safeguards intended to protect information, including authenticated
          access, server-side authorization, private file storage, access controls, and security logging. No system is
          completely secure, so we cannot guarantee absolute security.
        </p>
      </section>

      <section aria-labelledby="privacy-changes">
        <h2 id="privacy-changes">Changes to this policy</h2>
        <p className="mt-4 text-body">
          We may update this policy as AnatoLearn or applicable requirements change. The effective date above will be
          revised when an updated policy is posted.
        </p>
      </section>

      <section aria-labelledby="privacy-contact">
        <h2 id="privacy-contact">Contact us</h2>
        <p className="mt-4 text-body">
          For privacy questions, access or deletion requests, or other concerns, email{" "}
          <a href="mailto:rajrabidas001@gmail.com">rajrabidas001@gmail.com</a>.
        </p>
      </section>
    </article>
  );
}
