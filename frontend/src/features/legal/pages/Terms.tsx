// STARTING TEMPLATE — not legal advice. Review and adapt (ideally with a
// lawyer) before a public launch, especially the governing-law section.
import { Link } from "react-router-dom";
import LegalLayout, { Section } from "../components/LegalLayout";
import { CONTACT_EMAIL, MIN_AGE } from "../legalConfig";

const Terms = () => (
  <LegalLayout title="Terms of Service">
    <Section title="1. Agreement">
      <p>
        These Terms of Service ("Terms") govern your use of Glow (the "Service").
        By creating an account or using the Service, you agree to these Terms
        and to our <Link to="/privacy" className="underline">Privacy Policy</Link>.
        If you do not agree, do not use the Service.
      </p>
    </Section>

    <Section title="2. Who can use Glow">
      <p>
        You must be at least {MIN_AGE} years old to create an account. If you
        are under the age of majority where you live, you may only use Glow
        with the permission of a parent or legal guardian. Accounts we find
        belong to someone under {MIN_AGE} will be deleted.
      </p>
      <p>
        You may not use Glow if you have previously been banned from it, or if
        you are prohibited from receiving services under applicable law.
      </p>
    </Section>

    <Section title="3. Your account">
      <p>
        You are responsible for your account and for keeping your password
        secure. Give accurate information when you sign up, and do not
        impersonate anyone. Tell us right away at {CONTACT_EMAIL} if you think
        your account has been accessed without your permission.
      </p>
    </Section>

    <Section title="4. Your content">
      <p>
        You own the posts, photos, comments and other content you share
        ("Your Content"). By posting it, you give Glow a worldwide,
        non-exclusive, royalty-free license to host, store, display,
        reproduce and distribute Your Content only as needed to operate and
        improve the Service. This license ends when you delete the content or
        your account, except where it has been shared by others or we must
        keep it for legal reasons.
      </p>
      <p>
        You confirm that you have the rights to everything you post, and that
        it doesn't violate anyone else's rights or the law.
      </p>
    </Section>

    <Section title="5. What you can't do">
      <p>
        You agree to follow our{" "}
        <Link to="/guidelines" className="underline">Community Guidelines</Link>.
        In particular, you must not:
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>post content that is illegal, threatening, violent, hateful, sexually explicit, or that promotes terrorism or self-harm;</li>
        <li>post sexual content involving anyone under 18 — this is reported to authorities;</li>
        <li>harass, bully, threaten or impersonate others;</li>
        <li>share other people's private information without their consent;</li>
        <li>infringe copyrights, trademarks or other rights;</li>
        <li>spam, scam, or use bots or scrapers without our permission;</li>
        <li>try to break, overload, or get unauthorized access to the Service.</li>
      </ul>
    </Section>

    <Section title="6. Moderation and termination">
      <p>
        We may review, remove or limit content, and suspend or delete
        accounts, that we reasonably believe break these Terms or the law, or
        that put users or Glow at risk. Where appropriate we'll tell you why.
        You can report content or contact us at {CONTACT_EMAIL}.
      </p>
      <p>
        You can delete your account at any time from Settings. Deleting your
        account permanently removes your profile, posts, photos and comments.
      </p>
    </Section>

    <Section title="7. Copyright complaints">
      <p>
        If you believe content on Glow infringes your copyright, email{" "}
        {CONTACT_EMAIL} with: the work you own, where the infringing content
        is on Glow, your contact details, and a statement that you have a good
        faith belief the use isn't authorized. We will review and remove
        infringing content where appropriate.
      </p>
    </Section>

    <Section title="8. Disclaimers">
      <p>
        The Service is provided "as is" and "as available". We don't promise it
        will always be available, error-free or secure, and we are not
        responsible for content posted by users.
      </p>
    </Section>

    <Section title="9. Limitation of liability">
      <p>
        To the maximum extent permitted by law, Glow will not be liable for
        indirect, incidental, special, consequential or punitive damages, or
        for loss of data, profits or goodwill, arising from your use of the
        Service. Nothing in these Terms limits liability that cannot be
        limited under applicable law.
      </p>
    </Section>

    <Section title="10. Changes to these Terms">
      <p>
        We may update these Terms. If the changes are significant, we'll let
        you know in the app or by email before they take effect. Continuing to
        use Glow after that means you accept the updated Terms.
      </p>
    </Section>

    <Section title="11. Governing law">
      {/* TODO: set the country/jurisdiction that applies to you. */}
      <p>
        These Terms are governed by the laws of the country where Glow's
        operator is established, without regard to conflict-of-law rules,
        except where the law of your country of residence gives you
        protections that can't be waived.
      </p>
    </Section>

    <Section title="12. Contact">
      <p>Questions about these Terms? Email {CONTACT_EMAIL}.</p>
    </Section>
  </LegalLayout>
);

export default Terms;
