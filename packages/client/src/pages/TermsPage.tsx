import { useConfig } from '../contexts/ConfigContext';

export default function TermsPage() {
  const config = useConfig();

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-8 text-3xl font-bold text-text-primary">
          Terms of Service
        </h1>

        <div className="prose prose-gray dark:prose-invert">
          <p className="text-text-secondary">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            1. Acceptance of Terms
          </h2>
          <p className="text-text-secondary">
            By accessing and using {config.app.name}, you accept and agree to be
            bound by the terms and provision of this agreement.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            2. Use of Service
          </h2>
          <p className="text-text-secondary">
            You agree to use the service only for lawful purposes and in
            accordance with these Terms. You agree not to use the service in any
            way that could damage, disable, or impair the service.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            3. User Accounts
          </h2>
          <p className="text-text-secondary">
            When you create an account with us, you must provide accurate,
            complete, and current information. You are responsible for
            safeguarding the password and for all activities that occur under
            your account.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            4. Intellectual Property
          </h2>
          <p className="text-text-secondary">
            The service and its original content, features, and functionality
            are owned by {config.app.name} and are protected by international
            copyright, trademark, and other intellectual property laws.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            5. Limitation of Liability
          </h2>
          <p className="text-text-secondary">
            In no event shall {config.app.name}, nor its directors, employees,
            partners, agents, suppliers, or affiliates, be liable for any
            indirect, incidental, special, consequential, or punitive damages.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            6. Changes to Terms
          </h2>
          <p className="text-text-secondary">
            We reserve the right to modify or replace these Terms at any time.
            If a revision is material, we will try to provide at least 30 days
            notice prior to any new terms taking effect.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            7. Contact Us
          </h2>
          <p className="text-text-secondary">
            If you have any questions about these Terms, please contact us.
          </p>
        </div>
      </div>
    </div>
  );
}
