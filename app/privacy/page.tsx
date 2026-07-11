import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_PRODUCT_NAME,
  LEGAL_SITE_NAME,
  LEGAL_SITE_URL,
} from "@/lib/legal/config"

export const metadata: Metadata = {
  title: `Privacy Policy — ${LEGAL_SITE_NAME}`,
  description: `How ${LEGAL_SITE_NAME} collects, uses, and protects your information.`,
}

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description={`This policy describes how ${LEGAL_SITE_NAME} ("we", "us") handles information when you use our website, mobile apps, and tools, including ${LEGAL_PRODUCT_NAME}, SlabCrack, and Queue Watch.`}
    >
      <LegalSection title="1. Who we are">
        <p>
          {LEGAL_SITE_NAME} operates collector tools at{" "}
          <a href={LEGAL_SITE_URL}>{LEGAL_SITE_URL}</a>, including {LEGAL_PRODUCT_NAME} for
          organizing binders and coordinating trades with other collectors, SlabCrack for graded-card
          research, and Queue Watch for Pokémon Center virtual-queue alerts (web and native apps).
        </p>
        <p>
          Questions about this policy:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>
          <strong className="text-foreground">Account information.</strong> When you sign up, we
          collect your email address and authentication credentials through our auth provider
          (Supabase). We may also store a display name, handle, bio, location, and avatar you choose
          for your public profile.
        </p>
        <p>
          <strong className="text-foreground">Binder and trade data.</strong> Cards you add to I
          have / I want, trade offers, accepted trades, shipping details you enter, trade chat
          messages, and photos you upload in trade conversations.
        </p>
        <p>
          <strong className="text-foreground">Social data.</strong> Friend requests, friendships,
          reviews you write or receive, and binder visibility settings.
        </p>
        <p>
          <strong className="text-foreground">Usage and device data.</strong> We may collect
          standard web logs (IP address, browser type, pages visited, timestamps) and analytics
          events to understand how the service is used and to keep it secure.
        </p>
        <p>
          <strong className="text-foreground">Advertising data.</strong> If ads are shown (e.g.
          Google AdSense), Google and its partners may use cookies or similar technologies as
          described in{" "}
          <a
            href="https://policies.google.com/technologies/ads"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google&apos;s advertising policies
          </a>
          . You can manage ad personalization in your Google account settings. Paid Premium and Pro
          subscribers do not see in-app Sponsored ad slots while their plan is active.
        </p>
        <p>
          <strong className="text-foreground">Billing information.</strong> If you purchase
          Premium or Pro, payment is processed by Stripe. We receive subscription status, plan
          identifiers, and a Stripe customer ID. We do not store your full card number.
        </p>
        <p>
          <strong className="text-foreground">Mobile app &amp; Queue Watch.</strong> The CollecTools
          Android/iOS app may load our website in a WebView and open Pokémon Center in an in-app
          browser so you can complete bot checks. While Queue Watch monitoring is on, the app
          detects queue-related page signals on-device and may send queue status pings to our servers
          so your web Queue Watch page stays in sync. We do not ask you to enter Pokémon Center
          account passwords into CollecTools. Local device notifications may alert you when a queue
          appears live. Optional web push subscriptions (if you enable phone alerts on the website)
          store a push endpoint and related keys so we can deliver alerts.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <ul>
          <li>Provide and operate the service (binders, matching, messaging, trades).</li>
          <li>Authenticate you and keep your account secure.</li>
          <li>Show your profile and binder to other users according to your visibility settings.</li>
          <li>Sync card price estimates used for fair-value matching.</li>
          <li>Improve reliability, fix bugs, and prevent abuse.</li>
          <li>Process subscriptions and provide paid plan benefits.</li>
          <li>Comply with law and enforce our Terms of Service.</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>
      </LegalSection>

      <LegalSection title="4. How we share information">
        <p>
          <strong className="text-foreground">With other users.</strong> Information you mark public
          or share with friends (profile, binder lists, trade messages with a trade partner) is
          visible to those users as designed.
        </p>
        <p>
          <strong className="text-foreground">Service providers.</strong> We use trusted vendors to
          run the product, including:
        </p>
        <ul>
          <li>Supabase (database, authentication, file storage)</li>
          <li>Vercel (hosting and analytics)</li>
          <li>Stripe (subscription billing for Premium and Pro)</li>
          <li>Google AdSense (advertising, where enabled)</li>
          <li>Price data providers (e.g. PriceCharting, SoldComps) for market price estimates</li>
          <li>eBay Partner Network (affiliate link tracking when you open eBay from our tools)</li>
        </ul>
        <p>
          These providers process data on our behalf under their own privacy terms and only as
          needed to deliver the service.
        </p>
        <p>
          <strong className="text-foreground">Legal requirements.</strong> We may disclose
          information if required by law, court order, or to protect the rights, safety, and security
          of users and the public.
        </p>
      </LegalSection>

      <LegalSection title="5. Data retention">
        <p>
          We keep your account and binder data while your account is active. If you delete your
          account (or ask us to delete it), we will remove or anonymize personal data within a
          reasonable period, except where we must retain records for legal, security, or dispute
          resolution purposes.
        </p>
        <p>
          Trade messages and images may remain visible to the other party in the conversation history
          until both accounts are removed or the underlying trade records are deleted.
        </p>
      </LegalSection>

      <LegalSection title="6. Your choices and rights">
        <ul>
          <li>Update profile and binder visibility in the app.</li>
          <li>Remove cards from your binder or cancel pending trades.</li>
          <li>Request access, correction, or deletion of your data by emailing us.</li>
          <li>Opt out of non-essential cookies where your browser or ad settings allow.</li>
        </ul>
        <p>
          Depending on where you live, you may have additional rights under laws such as the GDPR or
          CCPA. Contact us and we will respond within a reasonable time.
        </p>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          We use industry-standard measures (encryption in transit, access controls, row-level
          security on user data) to protect information. No method of transmission or storage is
          100% secure; use a strong password and keep your login credentials private.
        </p>
      </LegalSection>

      <LegalSection title="8. Children">
        <p>
          {LEGAL_SITE_NAME} is not directed at children under 13. We do not knowingly collect
          personal information from children under 13. If you believe a child has provided us data,
          contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="9. International users">
        <p>
          Our infrastructure may process data in the United States and other countries where our
          providers operate. By using the service, you understand your information may be transferred
          to jurisdictions with different data protection laws than your own.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the revised version on
          this page and update the &quot;Last updated&quot; date. Continued use after changes means
          you accept the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Email: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
