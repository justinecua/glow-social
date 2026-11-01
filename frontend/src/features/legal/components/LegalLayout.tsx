import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { LAST_UPDATED } from "../legalConfig";
import LegalLinks from "./LegalLinks";

type LegalLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mt-8">
    <h2 className="mb-3 text-lg font-semibold text-[var(--title-color)]">
      {title}
    </h2>
    <div className="flex flex-col gap-3 text-sm leading-relaxed">{children}</div>
  </section>
);

const LegalLayout = ({ title, children }: LegalLayoutProps) => {
  const navigate = useNavigate();
  const goBack = () =>
    window.history.length > 1 ? navigate(-1) : navigate("/");

  return (
    <div className="min-h-screen w-full px-4 py-10">
      <article className="mx-auto w-full max-w-3xl rounded-xl bg-[var(--home-card)] p-6 sm:p-10">
        <button
          type="button"
          onClick={goBack}
          className="mb-6 inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--color-subtitle)] hover:text-[var(--title-color)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl font-bold text-[var(--title-color)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--color-subtitle)]">
          Last updated: {LAST_UPDATED}
        </p>
        {children}
        <div className="mt-10 border-t pt-6">
          <LegalLinks />
        </div>
      </article>
      <div className="fixed bottom-4 left-4">
        <ModeToggle />
      </div>
    </div>
  );
};

export default LegalLayout;
