// STARTING TEMPLATE — adjust to the community you want to build.
import LegalLayout, { Section } from "../components/LegalLayout";
import { CONTACT_EMAIL } from "../legalConfig";

const Guidelines = () => (
  <LegalLayout title="Community Guidelines">
    <Section title="Be good to each other">
      <p>
        Glow is a place to vibe with friends. These guidelines explain what
        isn't allowed. Breaking them can get your content removed or your
        account suspended or deleted.
      </p>
    </Section>

    <Section title="Not allowed">
      <ul className="ml-5 list-disc space-y-2">
        <li>
          <strong>Violence and threats:</strong> threatening anyone, praising
          or encouraging violence, or showing graphic violence or gore.
        </li>
        <li>
          <strong>Weapons and dangerous organizations:</strong> promoting
          terrorism, violent extremist groups or organized crime; selling or
          trading weapons, ammunition or explosives; posing with weapons to
          intimidate others.
        </li>
        <li>
          <strong>Hate:</strong> attacking people based on race, ethnicity,
          nationality, religion, sex, gender identity, sexual orientation,
          disability or serious disease.
        </li>
        <li>
          <strong>Harassment and bullying:</strong> targeting, shaming or
          repeatedly contacting someone who doesn't want it.
        </li>
        <li>
          <strong>Sexual content:</strong> nudity or sexually explicit content.
          Any sexual content involving minors is banned and reported to the
          authorities.
        </li>
        <li>
          <strong>Self-harm:</strong> promoting or encouraging suicide, self-harm
          or eating disorders. If you're struggling, please reach out to a
          local helpline.
        </li>
        <li>
          <strong>Private information:</strong> sharing someone's address,
          phone number, ID, or private photos without their permission.
        </li>
        <li>
          <strong>Illegal goods and activity:</strong> selling drugs, scams,
          fraud, or anything else illegal.
        </li>
        <li>
          <strong>Spam and fake accounts:</strong> impersonation, fake
          engagement, misleading links, or automated posting.
        </li>
        <li>
          <strong>Intellectual property:</strong> posting content you don't own
          or have permission to share.
        </li>
      </ul>
    </Section>

    <Section title="Reporting">
      <p>
        If you see something that breaks these guidelines, report it to{" "}
        {CONTACT_EMAIL}. Include a link to the post or profile. If someone is
        in immediate danger, contact local emergency services first.
      </p>
    </Section>
  </LegalLayout>
);

export default Guidelines;
