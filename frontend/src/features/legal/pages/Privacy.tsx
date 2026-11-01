// STARTING TEMPLATE — not legal advice. Make sure every statement here is
// true for how Glow actually handles data (providers, retention, location),
// and review it before a public launch.
import { Link } from "react-router-dom";
import LegalLayout, { Section } from "../components/LegalLayout";
import { CONTACT_EMAIL, MIN_AGE } from "../legalConfig";

const Privacy = () => (
  <LegalLayout title="Privacy Policy">
    <Section title="Overview">
      <p>
        This policy explains what personal information Glow collects, why, who
        we share it with, and the choices and rights you have. It applies to
        everyone who uses Glow.
      </p>
    </Section>

    <Section title="Information we collect">
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Account information:</strong> username, email address,
          password (stored only as a secure hash), and date of birth.
        </li>
        <li>
          <strong>Profile information you choose to add:</strong> name, gender,
          bio, profile and cover photos.
        </li>
        <li>
          <strong>Content:</strong> posts, photos, comments, replies, glows
          (likes) and friend connections.
        </li>
        <li>
          <strong>Consent records:</strong> which version of our Terms and
          Privacy Policy you accepted and when, and your marketing email choice.
        </li>
        <li>
          <strong>Technical information:</strong> IP address, browser and
          device information, and activity such as when you were last online.
          We use cookies that are strictly necessary to keep you signed in.
        </li>
      </ul>
    </Section>

    <Section title="How we use it">
      <ul className="ml-5 list-disc space-y-1">
        <li>to create and run your account and show your content to others;</li>
        <li>to keep Glow safe: preventing spam and abuse, moderating content, and enforcing our Terms;</li>
        <li>to check you meet the minimum age of {MIN_AGE};</li>
        <li>to send you account and security emails (such as password resets);</li>
        <li>to send product updates, only if you opted in — you can opt out at any time;</li>
        <li>to meet legal obligations.</li>
      </ul>
      <p>
        We rely on: performing our contract with you (the Terms), our
        legitimate interest in keeping the Service safe, your consent (for
        marketing), and legal obligations.
      </p>
    </Section>

    <Section title="Who can see your information">
      <p>
        Your username, profile photo, posts, photos and comments are visible
        to other users and may be visible to people who aren't signed in. Your
        email address, date of birth and password are never shown publicly.
      </p>
    </Section>

    <Section title="Who we share it with">
      <p>We don't sell your personal information. We share it only with:</p>
      <ul className="ml-5 list-disc space-y-1">
        {/* TODO: keep this list accurate as providers change. */}
        <li><strong>ImageKit</strong> — stores and delivers uploaded photos;</li>
        <li><strong>Mailgun</strong> — sends account emails;</li>
        <li><strong>Our hosting and database providers</strong> — run the Service;</li>
        <li><strong>Authorities</strong> — when required by law, or to protect someone's safety.</li>
      </ul>
      <p>
        These providers may process data in other countries. We use them
        only under agreements that require them to protect it.
      </p>
    </Section>

    <Section title="How long we keep it">
      <p>
        We keep your information while your account is active. When you
        delete your account, we permanently delete your profile, posts,
        photos, comments and glows. Some records may remain in backups for a
        limited time, or longer where the law requires it.
      </p>
    </Section>

    <Section title="Your rights and choices">
      <p>Depending on where you live, you have the right to:</p>
      <ul className="ml-5 list-disc space-y-1">
        <li><strong>Access</strong> your data — use <em>Settings → Download my data</em>;</li>
        <li><strong>Correct</strong> it — edit your profile, or contact us;</li>
        <li><strong>Delete</strong> it — use <em>Settings → Delete account</em>;</li>
        <li><strong>Object</strong> to or restrict certain processing, and withdraw consent;</li>
        <li><strong>Complain</strong> to your data protection authority (for example, the National Privacy Commission in the Philippines, or your local authority in the EU/UK).</li>
      </ul>
      <p>
        To exercise any right, use <Link to="/settings" className="underline">Settings</Link>{" "}
        or email {CONTACT_EMAIL}.
      </p>
    </Section>

    <Section title="Children">
      <p>
        Glow is not for children under {MIN_AGE}. We don't knowingly collect
        their information. If you believe a child under {MIN_AGE} has an
        account, contact {CONTACT_EMAIL} and we'll delete it.
      </p>
    </Section>

    <Section title="Security">
      <p>
        Passwords are hashed and sessions use secure, HTTP-only cookies. No
        system is perfectly secure; if a breach affects your data, we will
        notify you and the authorities as the law requires.
      </p>
    </Section>

    <Section title="Changes">
      <p>
        If we make significant changes to this policy, we'll tell you in the
        app or by email before they take effect.
      </p>
    </Section>

    <Section title="Contact">
      <p>Privacy questions or requests: {CONTACT_EMAIL}.</p>
    </Section>
  </LegalLayout>
);

export default Privacy;
