import trakalogLogo from "@/assets/trakalog-logo.png";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-center">
          <a href="/" className="flex items-center justify-center gap-3">
            <img src={trakalogLogo} alt="Trakalog" className="h-10" />
            <span className="text-xl font-bold tracking-wider uppercase" style={{ background: "linear-gradient(90deg, #f97316, #ec4899, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Trakalog</span>
          </a>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="py-6 text-center">
        <a href="https://trakalog.com" target="_blank" rel="noopener noreferrer" className="text-[10px] hover:opacity-80 transition-opacity" style={{ color: "#f97316" }}>
          {"Powered by Trakalog \u2726"}
        </a>
      </footer>
    </div>
  );
}

export default function PrivacyPolicy() {
  return (
    <Shell>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
            <p className="text-muted-foreground text-sm">Last updated: March 19, 2026</p>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            Trakalog ("we", "our", "us") is a SaaS platform for managing pre-release music catalogs.
            This Privacy Policy explains how we collect, use, and protect your personal information
            when you use our service.
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect the following personal information when you create an account or use our service:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>
                <span className="font-medium text-foreground">Account information:</span> first name, last name,
                email address, role, and company name — collected during sign-up via our onboarding screen
                or through Google OAuth.
              </li>
              <li>
                <span className="font-medium text-foreground">Authentication data:</span> email and OAuth tokens
                provided by Google when you sign in with Google.
              </li>
              <li>
                <span className="font-medium text-foreground">Content you upload:</span> audio files, stems,
                cover artwork, track metadata, playlists, and any other content you add to your catalog.
              </li>
              <li>
                <span className="font-medium text-foreground">Usage data:</span> workspace activity, shared link
                interactions, and pitch engagement metrics.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use your information to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Provide and operate the Trakalog platform, including catalog management, playlist creation, and team collaboration.</li>
              <li>Enable you to send pitches to contacts and track engagement.</li>
              <li>Generate and manage shared links for your tracks and playlists.</li>
              <li>Send transactional emails related to your account (invitations, notifications).</li>
              <li>Improve and maintain the service.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Data Storage</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored on Supabase infrastructure hosted in the United States. Audio files,
              stems, and cover artwork are stored in Supabase Storage. All data is transmitted over
              encrypted connections (TLS/SSL) and access is controlled through row-level security policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Third-Party Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, rent, or trade your personal information to third parties. We only share
              data with third-party services strictly necessary to operate the platform (e.g., Supabase
              for database and storage, Vercel for hosting, Google for OAuth authentication).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Trakalog uses cookies solely for authentication session management. We do not use
              advertising cookies, tracking pixels, or any third-party analytics cookies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>
                <span className="font-medium text-foreground">Access</span> the personal data we hold about you.
              </li>
              <li>
                <span className="font-medium text-foreground">Modify</span> your account information at any time
                through your account settings.
              </li>
              <li>
                <span className="font-medium text-foreground">Delete</span> your account and all associated data
                by contacting us.
              </li>
              <li>
                <span className="font-medium text-foreground">Export</span> your data upon request.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              {"For any questions or requests regarding your privacy, contact us at "}
              <a href="mailto:privacy@trakalog.com" className="text-primary hover:underline">
                privacy@trakalog.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </Shell>
  );
}
