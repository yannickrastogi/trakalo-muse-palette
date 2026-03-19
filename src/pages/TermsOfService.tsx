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

export default function TermsOfService() {
  return (
    <Shell>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
            <p className="text-muted-foreground text-sm">Last updated: March 19, 2026</p>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            These Terms of Service ("Terms") govern your use of the Trakalog platform. By creating
            an account or using the service, you agree to be bound by these Terms.
          </p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">1. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Trakalog is a SaaS platform for managing pre-release music catalogs. The service allows
              users to upload, organize, and share music tracks, stems, and playlists; send pitches to
              industry contacts; collaborate with team members within workspaces; and track engagement
              on shared content.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">2. Accounts and Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the security of your account credentials. You must
              provide accurate information when creating your account. You are responsible for all
              activity that occurs under your account. You must notify us immediately if you suspect
              unauthorized access to your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">3. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain full ownership of all music, audio files, artwork, and other content you
              upload to Trakalog. By uploading content, you grant us a limited license to store,
              process, and deliver your content solely for the purpose of providing the service
              (e.g., streaming via shared links, generating previews). We claim no intellectual
              property rights over your content.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Upload content that you do not have the rights to distribute.</li>
              <li>Use the platform to distribute malware or harmful content.</li>
              <li>Attempt to gain unauthorized access to other users' accounts or data.</li>
              <li>Use the service in any way that violates applicable laws or regulations.</li>
              <li>Abuse, overload, or interfere with the proper functioning of the platform.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">5. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Trakalog is provided "as is" without warranties of any kind, either express or implied.
              We are not liable for any loss of data, revenue, or profits arising from your use of
              the service. Our total liability to you for any claims arising from or related to the
              service is limited to the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">6. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may delete your account at any time. We reserve the right to suspend or terminate
              your account if you violate these Terms. Upon termination, your data will be deleted
              in accordance with our Privacy Policy. We may provide reasonable notice before
              termination when possible.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">7. Changes to These Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. We will notify you of significant changes
              via email or through the platform. Continued use of the service after changes take
              effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">8. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              {"For any questions regarding these Terms, contact us at "}
              <a href="mailto:legal@trakalog.com" className="text-primary hover:underline">
                legal@trakalog.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </Shell>
  );
}
