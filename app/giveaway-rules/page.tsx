import type { Metadata } from "next"
import Link from "next/link"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"
import {
  FREE_ACTIVE_MINUTES_REQUIRED,
  GIVEAWAY_CONTACT_EMAIL,
  GIVEAWAY_MAILING_ADDRESS,
  GIVEAWAY_PRIZE_PER_ACCOUNT_USD,
  giveawayPrizeArvUsd,
  MAIL_IN_ENTRIES_PER_POSTCARD,
  MAX_MAIL_IN_POSTCARDS_PER_MONTH,
  MONTHLY_ENTRY_CAP,
  PREMIUM_ACTIVE_MINUTES_REQUIRED,
} from "@/lib/giveaway/constants"
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_SITE_NAME,
  LEGAL_SITE_URL,
} from "@/lib/legal/config"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Monthly Giveaway — Official Rules",
  description: `Official rules for the ${LEGAL_SITE_NAME} monthly giveaway. No purchase necessary.`,
  path: "/giveaway-rules",
})

const RULES_LAST_UPDATED = "July 16, 2026"

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default function GiveawayRulesPage() {
  const exampleAccounts = 10_000
  const examplePrize = giveawayPrizeArvUsd(exampleAccounts)

  return (
    <LegalPageShell
      title="Monthly Giveaway — Official Rules"
      description={`NO PURCHASE NECESSARY. Open to eligible users as described below. Sponsor: ${LEGAL_SITE_NAME}.`}
    >
      <p className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Important:</strong> These rules are provided for transparency and
        should be reviewed by qualified counsel before a public launch. {LEGAL_SITE_NAME} does not offer legal
        advice. Participation may be limited while the giveaway is in preview.
      </p>

      <p className="mb-6 text-xs text-muted-foreground">Rules last updated: {RULES_LAST_UPDATED}</p>

      <LegalSection title="1. Sponsor">
        <p>
          The {LEGAL_SITE_NAME} Monthly Giveaway (the &quot;Promotion&quot;) is sponsored by {LEGAL_SITE_NAME}{" "}
          (&quot;Sponsor&quot;), operator of the collector tools website at{" "}
          <a href={LEGAL_SITE_URL}>{LEGAL_SITE_URL}</a>.
        </p>
        <p>
          Questions:{" "}
          <a href={`mailto:${GIVEAWAY_CONTACT_EMAIL}`}>{GIVEAWAY_CONTACT_EMAIL}</a> (or{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>).
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          The Promotion is open to natural persons who are at least eighteen (18) years old and legal residents of
          the fifty (50) United States or the District of Columbia at the time of entry, except where prohibited
          or restricted by law.
        </p>
        <p>
          Employees, officers, and directors of Sponsor and their immediate family members (spouse, parents,
          siblings, and children) and household members are not eligible. Void where prohibited.
        </p>
        <p>
          By entering, you represent that you meet these requirements. Sponsor may verify eligibility before
          awarding a prize and may disqualify any entry that does not comply with these Official Rules.
        </p>
      </LegalSection>

      <LegalSection title="3. Promotion period and drawing">
        <p>
          Each Promotion period is one calendar month (e.g., entries earned in July count toward the July drawing).
          The Promotion begins at 12:00:00 a.m. Coordinated Universal Time (UTC) on the first day of the month and
          ends at 11:59:59 p.m. UTC on the last day of that month.
        </p>
        <p>
          On or about the first day of the following calendar month at 6:00 a.m. UTC, Sponsor will conduct a
          random drawing from among all eligible entries received during the completed Promotion period. Odds of
          winning depend on the number of eligible entries received.
        </p>
      </LegalSection>

      <LegalSection title="4. How to enter (no purchase necessary)">
        <p>
          <strong className="text-foreground">There are two (2) ways to enter. A purchase or paid subscription is
          not required.</strong>
        </p>
        <ul>
          <li>
            <strong className="text-foreground">App usage (free method):</strong> Sign in to a {LEGAL_SITE_NAME}{" "}
            account and use the Service while signed in with the application tab active. Free accounts earn one (1)
            entry per calendar day after accumulating at least {FREE_ACTIVE_MINUTES_REQUIRED} active minutes that
            day. Premium, Pro, and Supreme accounts earn one (1) entry per calendar day after at least{" "}
            {PREMIUM_ACTIVE_MINUTES_REQUIRED} active minutes that day. Maximum one (1) app-usage entry per day.
          </li>
          <li>
            <strong className="text-foreground">Mail-in alternate method of entry (AMOE):</strong> Hand-print your
            full name, email address associated with your {LEGAL_SITE_NAME} account (or note that you do not yet
            have an account), mailing address, and the words &quot;{LEGAL_SITE_NAME} Monthly Giveaway&quot; on a
            postcard or letter and mail it in a stamped envelope to the address in Section 10. Each valid mail-in
            received and processed during a Promotion period awards {MAIL_IN_ENTRIES_PER_POSTCARD} entries for that
            period, up to {MAX_MAIL_IN_POSTCARDS_PER_MONTH} mail-ins per person per period.
          </li>
        </ul>
        <p>
          Combined app and mail-in entries are capped at {MONTHLY_ENTRY_CAP} entries per person per Promotion
          period. Entries in excess of the cap will not be counted. Automated, bulk, or fraudulent entries are
          prohibited.
        </p>
      </LegalSection>

      <LegalSection title="5. Prize — variable value based on total accounts">
        <p>
          <strong className="text-foreground">One (1) prize per Promotion period.</strong> The winner will receive
          one (1) Pokémon Trading Card Game card (&quot;Prize Card&quot;) selected by Sponsor.
        </p>
        <p>
          The approximate retail value (&quot;ARV&quot;) of the Prize Card is calculated as follows:
        </p>
        <ul>
          <li>
            Each calendar day during a Promotion period, Sponsor records a running total of registered user accounts
            on {LEGAL_SITE_NAME} (a &quot;Daily Account Snapshot&quot;).
          </li>
          <li>
            The <strong className="text-foreground">Account Snapshot</strong> for that Promotion period is the
            Daily Account Snapshot taken on the last calendar day of that month (UTC). That month-end total is the
            official prize value for the drawing held for that period.
          </li>
          <li>
            Prize ARV = Account Snapshot × {formatUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)} per account.
          </li>
          <li>
            Sponsor will select a Prize Card with a fair-market value reasonably close to that ARV, based on
            reputable third-party market sources (e.g., recent sold listings or established price guides) at or
            near the time of fulfillment.
          </li>
        </ul>
        <p>
          <strong className="text-foreground">Example:</strong> If the Account Snapshot is{" "}
          {exampleAccounts.toLocaleString("en-US")} accounts, the Prize ARV is {formatUsd(examplePrize)} (
          {exampleAccounts.toLocaleString("en-US")} × {formatUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)}). The actual card,
          set, grade, and condition are chosen by Sponsor in its sole discretion, provided the market value aligns
          with the calculated ARV.
        </p>
        <p>
          Prize is non-transferable except at Sponsor&apos;s discretion. No cash equivalent or substitution except
          Sponsor may substitute a prize of equal or greater ARV if the advertised prize becomes unavailable.
        </p>
      </LegalSection>

      <LegalSection title="6. Winner selection and notification">
        <p>
          One (1) winner will be selected by random drawing from all eligible entries for the completed Promotion
          period. Each entry row in Sponsor&apos;s entry log counts as one chance to win; mail-in entries that
          award multiple rows increase odds proportionally.
        </p>
        <p>
          Sponsor will attempt to notify the potential winner using the email address associated with the winning
          account within approximately fourteen (14) days after the drawing. The potential winner may be required
          to sign an affidavit of eligibility, liability release, and (where lawful) a publicity release within
          seven (7) days of notification or the prize may be forfeited and an alternate winner selected.
        </p>
        <p>
          Sponsor is not responsible for undeliverable notifications, spam filters, or outdated contact information.
        </p>
      </LegalSection>

      <LegalSection title="7. Taxes">
        <p>
          Winner is responsible for all federal, state, and local taxes arising from acceptance of the prize.
          Sponsor may issue tax forms as required by law for prizes above applicable reporting thresholds.
        </p>
      </LegalSection>

      <LegalSection title="8. Release and limitation of liability">
        <p>
          By entering, you agree to release and hold harmless Sponsor and its affiliates, officers, directors,
          employees, and agents from any liability, illness, injury, death, loss, or damage arising from
          participation or acceptance, use, or misuse of the prize, except where such release is prohibited by law.
        </p>
        <p>
          The Promotion is governed by these Official Rules and applicable United States law. Any disputes shall be
          resolved individually in the courts of competent jurisdiction in the United States.
        </p>
      </LegalSection>

      <LegalSection title="9. Privacy">
        <p>
          Information collected in connection with the Promotion is handled as described in our{" "}
          <Link href="/privacy">Privacy Policy</Link>. By entering, you consent to Sponsor using your information
          to administer the Promotion and contact winners.
        </p>
      </LegalSection>

      <LegalSection id="mail-in" title="10. Mail-in address (AMOE)">
        <p>
          Mail alternate entries to:
          <br />
          <strong className="text-foreground">{GIVEAWAY_MAILING_ADDRESS}</strong>
        </p>
        <p>
          Each mail-in must be postmarked by the last day of the Promotion period and received within a reasonable
          processing window as determined by Sponsor. Limit {MAX_MAIL_IN_POSTCARDS_PER_MONTH} mail-ins per person
          per period. Questions about mail-in eligibility:{" "}
          <a href={`mailto:${GIVEAWAY_CONTACT_EMAIL}`}>{GIVEAWAY_CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection title="11. General conditions">
        <p>
          Sponsor reserves the right to cancel, suspend, or modify the Promotion if fraud, technical failures, or
          any factor impairs the integrity of the Promotion, or to comply with law. Sponsor&apos;s decisions are
          final.
        </p>
        <p>
          For entry tracking and status while the Promotion is available in the app, visit{" "}
          <Link href="/giveaway">/giveaway</Link> when signed in (availability may be limited during preview).
        </p>
        <p>
          These Official Rules, together with the <Link href="/terms">Terms of Service</Link>, govern the
          Promotion.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
