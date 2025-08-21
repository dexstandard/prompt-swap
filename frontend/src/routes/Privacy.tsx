export default function Privacy() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Privacy Policy</h2>
      <p>
        We collect only the information required to run the service. When you sign
        in with Google we record your Google account ID. Your email is used only for
        display and is not stored in our database. Agent configuration data and
        optional two-factor authentication secrets are also saved.
      </p>
      <p>
        API keys for AI providers and exchanges are encrypted using a server-side
        password before being saved in our database. These keys are used solely to
        make requests on your behalf and are never shared with third parties.
      </p>
      <p>
        You may delete your API keys or disable two-factor authentication at any
        time from the application settings.
      </p>
    </div>
  );
}
