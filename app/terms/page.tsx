import type { Metadata } from "next"
import Link from "next/link"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_PRODUCT_NAME,
  LEGAL_SITE_NAME,
  LEGAL_SITE_URL,
} from "@/lib/legal/config"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms governing use of ${LEGAL_SITE_NAME} and ${LEGAL_PRODUCT_NAME}.`,
  alternates: { canonical: `${LEGAL_SITE_URL.replace(/\/$/, "")}/terms` },
}

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      description={`Please read these terms before using ${LEGAL_SITE_NAME} or ${LEGAL_PRODUCT_NAME}.`}
    >
      <LegalSection title="1. Agreement">
        <p>
          By accessing or using {LEGAL_SITE_NAME} at{" "}
          <a href={LEGAL_SITE_URL}>{LEGAL_SITE_URL}</a> (the &quot;Service&quot;), you agree to
          these Terms of Service and our{" "}
          <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Service.
        </p>
        <p>
          You must be at least 13 years old (or the minimum age required in your country) to create
          an account. If you are under 18, you should use the Service only with a parent or
          guardian&apos;s permission.
        </p>
      </LegalSection>

      <LegalSection title="2. What we provide">
        <p>
          {LEGAL_SITE_NAME} offers collector tools including {LEGAL_PRODUCT_NAME}, which helps you
          list cards, find potential trade matches, message other collectors, and coordinate trades.
        </p>
        <p>
          <strong className="text-foreground">We are a matching and communication platform only.</strong>{" "}
          We do not buy, sell, authenticate, grade, store, ship, or take custody of cards. We do not
          process payments between users, provide escrow, or guarantee that any trade will complete
          successfully.
        </p>
      </LegalSection>

      <LegalSection title="3. Peer-to-peer trading disclaimer">
        <p>
          All trades arranged through {LEGAL_PRODUCT_NAME} are strictly between you and the other
          collector. You are solely responsible for:
        </p>
        <ul>
          <li>Verifying card authenticity, condition, and value before trading.</li>
          <li>Agreeing on payment method (if any), shipping method, insurance, and packaging.</li>
          <li>Complying with applicable laws, taxes, and carrier rules.</li>
          <li>Resolving disputes with your trade partner.</li>
        </ul>
        <p>
          Card prices shown in the app are estimates from third-party sources for matching purposes
          only. They are not offers to buy or sell and may be inaccurate or out of date.
        </p>
        <p>
          <strong className="text-foreground">
            USE TRADES AT YOUR OWN RISK. WE ARE NOT LIABLE FOR LOST, DAMAGED, FAKE, OR
            MISREPRESENTED CARDS, OR FOR ANY DISPUTE BETWEEN USERS.
          </strong>
        </p>
      </LegalSection>

      <LegalSection title="4. Your account">
        <ul>
          <li>Provide accurate information and keep your login credentials secure.</li>
          <li>You are responsible for all activity under your account.</li>
          <li>Notify us promptly if you suspect unauthorized access.</li>
          <li>One person per account; do not impersonate others or misrepresent your identity.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. User content and conduct">
        <p>
          You retain ownership of content you submit (binder listings, messages, photos, reviews). You
          grant us a limited license to host, display, and transmit that content solely to operate
          the Service.
        </p>
        <p>You agree not to:</p>
        <ul>
          <li>Post false, misleading, or fraudulent trade listings or offers.</li>
          <li>Harass, threaten, defraud, or abuse other users.</li>
          <li>Upload malware, spam, or illegal content.</li>
          <li>Scrape, reverse engineer, or overload the Service without permission.</li>
          <li>Circumvent security, visibility settings, or trade locks.</li>
          <li>Use the Service for money laundering or other illegal activity.</li>
        </ul>
        <p>
          We may remove content or suspend accounts that violate these terms or harm the community,
          with or without notice.
        </p>
      </LegalSection>

      <LegalSection title="6. Binder visibility and matching">
        <p>
          You control whether your binder is private, friends-only, or public. Matching and discovery
          features depend on the data you choose to share and on price estimates we sync from
          third parties. We do not guarantee matches, response times, or trade outcomes.
        </p>
      </LegalSection>

      <LegalSection title="7. Reviews">
        <p>
          Reviews should reflect genuine completed trade experiences. Fake, retaliatory, or paid
          reviews are prohibited. We may remove reviews that violate these terms.
        </p>
      </LegalSection>

      <LegalSection title="8. Advertising">
        <p>
          The Service may display third-party advertisements (e.g. Google AdSense) for free users.
          Ads are provided by third parties; we do not endorse advertised products. Your dealings
          with advertisers are solely between you and them.
        </p>
        <p>
          Paid <strong className="text-foreground">Premium</strong> and{" "}
          <strong className="text-foreground">Pro</strong> plans remove in-app Sponsored ad slots
          while the subscription is active. Queue Watch features require Pro.
        </p>
      </LegalSection>

      <LegalSection title="9. Paid subscriptions (Premium & Pro)">
        <p>
          Optional paid plans are billed through Stripe. Current offerings (subject to change on the{" "}
          <a href="/pricing">pricing</a> page) include:
        </p>
        <ul>
          <li>
            <strong className="text-foreground">Premium</strong> — full SlabCrack deficit feed and
            ad-free access to {LEGAL_PRODUCT_NAME} tools ($4.99/mo or $39.99/yr).
          </li>
          <li>
            <strong className="text-foreground">Pro</strong> — everything in Premium, plus Pokemon
            Center Queue Watch and related Pro features ($9.99/mo or $99.99/yr).
          </li>
        </ul>
        <p>
          The free tier includes a limited SlabCrack preview (a sample of mid-deficit cards) and
          other tools with ads, as described on the pricing page.
        </p>
        <p>
          Fees are charged in advance on a recurring monthly or yearly basis until you cancel.
          You can manage or cancel in the Stripe customer portal linked from the pricing page, or by
          contacting us. Cancellation stops future renewals; you retain paid benefits until the end
          of the current billing period unless otherwise required by law.
        </p>
        <p>
          Except where required by law, subscription fees are non-refundable. We may change prices
          with notice; changes apply on the next renewal unless you cancel. Paid features may be
          modified or discontinued; if we discontinue a paid feature you paid for, we will provide
          a prorated credit or refund where required by law.
        </p>
        <p>
          Subscription billing is handled by Stripe. We do not store your full card number; Stripe
          processes payments under its terms and privacy policy.
        </p>
      </LegalSection>

      <LegalSection title="10. Intellectual property">
        <p>
          {LEGAL_SITE_NAME}, its branding, software, and design are owned by us or our licensors.
          Pokémon, TCG set names, and card images may be trademarks or copyrights of their respective
          owners. {LEGAL_SITE_NAME} is a fan tool and is not affiliated with or endorsed by The
          Pokémon Company, Nintendo, or card publishers.
        </p>
      </LegalSection>

      <LegalSection title="11. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate your access if you
          breach these terms, create risk for other users, or if we discontinue the Service. Unpaid
          amounts remain due. Sections that by nature should survive (disclaimers, liability limits,
          dispute terms) will survive termination.
        </p>
      </LegalSection>

      <LegalSection title="12. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
          OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT UNINTERRUPTED OR ERROR-FREE OPERATION,
          INCLUDING QUEUE WATCH ALERTS OR MARKET PRICE DATA.
        </p>
      </LegalSection>

      <LegalSection title="13. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {LEGAL_SITE_NAME.toUpperCase()} AND ITS
          OPERATORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, GOODWILL, OR COLLECTIBLE VALUE,
          ARISING FROM YOUR USE OF THE SERVICE OR ANY TRADE WITH ANOTHER USER.
        </p>
        <p>
          OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE GREATER OF (A)
          USD $100 OR (B) THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM.
        </p>
      </LegalSection>

      <LegalSection title="14. Indemnification">
        <p>
          You agree to indemnify and hold harmless {LEGAL_SITE_NAME} and its operators from claims,
          damages, and expenses (including reasonable legal fees) arising from your use of the
          Service, your content, your trades with other users, or your violation of these terms.
        </p>
      </LegalSection>

      <LegalSection title="15. Disputes and governing law">
        <p>
          These terms are governed by the laws of the United States and the State of Delaware,
          without regard to conflict-of-law rules, except where mandatory consumer protection laws in
          your country apply.
        </p>
        <p>
          For informal resolution, contact us first at{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. Any formal dispute
          will be resolved in the state or federal courts located in Delaware, unless applicable law
          requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="16. Changes">
        <p>
          We may modify these Terms from time to time. We will post the updated version on this page.
          Material changes may also be noted in the app. Continued use after the effective date
          constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="17. Contact">
        <p>
          Questions about these Terms:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
