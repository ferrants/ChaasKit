import { useConfig } from '../contexts/ConfigContext';

export default function PrivacyPage() {
  const config = useConfig();

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-8 text-3xl font-bold text-text-primary">
          Privacy Policy
        </h1>

        <div className="prose prose-gray dark:prose-invert">
          <p className="text-text-secondary">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            1. Information We Collect
          </h2>
          <p className="text-text-secondary">
            {config.app.name} collects information you provide directly to us,
            such as when you create an account, send messages, or contact us for
            support.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            2. How We Use Your Information
          </h2>
          <p className="text-text-secondary">
            We use the information we collect to provide, maintain, and improve
            our services, and to communicate with you about your account and our
            services.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            3. Data Retention
          </h2>
          <p className="text-text-secondary">
            We retain your information for as long as your account is active or
            as needed to provide you services. You can request deletion of your
            data at any time.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            4. Data Security
          </h2>
          <p className="text-text-secondary">
            We implement appropriate technical and organizational measures to
            protect your personal information against unauthorized access,
            alteration, disclosure, or destruction.
          </p>

          <h2 className="mt-8 text-xl font-semibold text-text-primary">
            5. Contact Us
          </h2>
          <p className="text-text-secondary">
            If you have any questions about this Privacy Policy, please contact
            us.
          </p>
        </div>
      </div>
    </div>
  );
}
