// The Pool Guide: a short, plain-language guide to how a QFinera pool works.
// Shown inside every pool (GuideView) and, for anyone, from Learn
// (/qfinera/learn/pool-guide via PoolGuideContent). Describes the rules the
// services enforce; keep it in step with docs/qfinera-fund/ACCOUNTING_RULES.md.
// Server component: no client JavaScript.
import { Disclaimer, PageHeader, SectionCard } from "@/components/fund/parts";

type Section = { id: string; title: string; body: React.ReactNode };

const P = ({ children }: { children: React.ReactNode }) => <p className="text-[14px] leading-relaxed text-[var(--qf-ink)]">{children}</p>;
const List = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="ml-5 list-disc space-y-1 text-[14px] leading-relaxed text-[var(--qf-ink)]">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);
const Term = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold">{children}</strong>;

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    title: "Getting started",
    body: (
      <>
        <P>
          A pool is a private, invite-only group that pools money and keeps one shared record of its contributions, trades, positions and value. QFinera is a
          record-keeping system: it does not hold money and does not place orders. Trades are placed by the pool at its own broker and then recorded here.
        </P>
        <List
          items={[
            "Members join by invitation and record their contributions.",
            "Each contribution buys units at the official NAV (net asset value per unit), so every member's share is tracked fairly.",
            "Managers record trades from contract notes; the pool's positions, cash and P&L follow from those records.",
            "The administrator strikes the official end-of-day NAV, which is what units are bought and redeemed at.",
          ]}
        />
      </>
    ),
  },
  {
    id: "roles",
    title: "Roles: Viewer, Member, Manager, Admin",
    body: (
      <List
        items={[
          <><Term>Viewer</Term>: read-only. Sees the pool&apos;s NAV, positions, trades and reports, and their own records. Can ask to become a member with &ldquo;Request to join as member&rdquo;.</>,
          <><Term>Member</Term>: everything a viewer sees, plus recording their own contributions and withdrawals, commenting, and adding watchlist notes.</>,
          <><Term>Manager</Term>: runs the pool day to day: records trades, expenses and contributions on a member&apos;s behalf, and reviews join requests. Approval-level changes go to an admin first (see below).</>,
          <><Term>Admin</Term>: full control: approves money movements and manager requests, records prices, strikes the NAV, corrects or reverses trades, changes roles and settings, and can delete the pool.</>,
          "Every action is checked on the server against your role; hiding a button is only a convenience.",
        ]}
      />
    ),
  },
  {
    id: "approvals",
    title: "Manager requests and admin approval",
    body: (
      <>
        <P>
          When a manager makes an approval-level change (approving a contribution or withdrawal, reversing or correcting a trade, striking the NAV, changing a
          role or a setting, or deleting the pool), QFinera records it as a <Term>request</Term> instead. Nothing changes until an admin approves it on the
          Approvals page.
        </P>
        <List
          items={[
            "Each request shows who asked, what would change (before → after), and why.",
            "Approving applies the change with the admin's authority, running every normal check again. Rejecting changes nothing.",
            "Every request, approval and rejection is in the audit trail.",
          ]}
        />
      </>
    ),
  },
  {
    id: "contributions",
    title: "Contributions",
    body: (
      <>
        <P>
          Pay into the pool&apos;s bank account first, then record the payment with its method, UTR/reference, date, a screenshot or PDF as proof, and any notes.
        </P>
        <List
          items={[
            <><Term>Pending approval</Term>: an admin reviews the payment details and proof.</>,
            <><Term>Approved</Term>: accepted; the admin still has to see the money in the bank.</>,
            <><Term>Funds confirmed</Term>: the money has arrived. This moment fixes which NAV applies (the next end-of-day NAV after the pool&apos;s cutoff time).</>,
            <><Term>Awaiting NAV</Term>: waiting for that NAV to be struck. No units yet.</>,
            <><Term>Finalized</Term>: units allocated at the official NAV (amount ÷ NAV). The rounding remainder stays with the pool.</>,
            "An admin cannot approve or confirm their own contribution while another admin exists. A pool's sole admin can; the step is recorded in the audit trail as self-confirmed.",
          ]}
        />
      </>
    ),
  },
  {
    id: "withdrawals",
    title: "Withdrawals",
    body: (
      <P>
        Request a withdrawal; an admin approves it, and it is settled at the next official end-of-day NAV: your units are redeemed at that NAV and the cash is
        paid out. A member can have only one open withdrawal at a time, and the pool must have the cash to pay it.
      </P>
    ),
  },
  {
    id: "trading",
    title: "Trading: delivery, intraday, futures, options",
    body: (
      <>
        <List
          items={[
            <><Term>Equity delivery</Term>: buying shares to own them. The full value plus charges leaves cash; selling brings it back. Long only.</>,
            <><Term>Equity intraday</Term>: positions opened and closed the same day, long or short. Only charges move cash when you open; the close settles the price difference. Intraday positions must be squared off before that day&apos;s NAV can be struck.</>,
            <><Term>Futures</Term>: a futures contract, long or short, settled the same way as intraday (price difference only). No margin is modelled.</>,
            <><Term>Options</Term>: a call (CE) or put (PE) contract. Buying pays the premium; writing (selling) receives the premium, and the open short is valued as a liability.</>,
          ]}
        />
        <P>
          Charges are entered as one <Term>estimated charges</Term> figure: your estimate or the contract-note total. QFinera does not calculate broker charges.
          An admin can edit an executed trade to match the contract note; the earlier values are kept in the trade&apos;s revision history.
        </P>
      </>
    ),
  },
  {
    id: "actions",
    title: "Open long, open short, close long, close short",
    body: (
      <>
        <List
          items={[
            <><Term>Open long</Term> (a buy): start or add to a position that gains when the price rises.</>,
            <><Term>Close long</Term> (a sell): reduce or exit that position.</>,
            <><Term>Open short</Term> (a sell): start or add to a position that gains when the price falls. No holding is needed (intraday, futures, options).</>,
            <><Term>Close short</Term> (a buy): buy back to reduce or exit the short.</>,
          ]}
        />
        <P>
          You cannot close more than is open, and a position cannot flip from long to short in one trade: close it, then open the other side. Example: open short
          100 INFY at ₹1,520, close 40 at ₹1,500 (₹800 realized, 60 still short), then close 60 at ₹1,490 (₹1,800 realized; the position is closed).
        </P>
      </>
    ),
  },
  {
    id: "positions",
    title: "Positions",
    body: (
      <P>
        Positions are calculated from executed trades, per instrument and product, using average cost. Equity delivery positions are the pool&apos;s holdings;
        intraday, futures and options positions are shown separately. Filter by long, short or closed. Prices shown are for display and labelled by quality
        (live, delayed, end-of-day or manual); a missing price is shown as missing, never guessed.
      </P>
    ),
  },
  {
    id: "pnl",
    title: "Realized and unrealized P&L",
    body: (
      <List
        items={[
          <><Term>Realized P&amp;L</Term>: profit or loss locked in by closing trades, after all charges.</>,
          <><Term>Unrealized P&amp;L</Term>: the profit or loss on open positions at the latest price. It changes with the price until the position is closed.</>,
          <><Term>Exposure</Term>: the value of open long and short positions (gross = long + short; net = long − short). Options count at premium value.</>,
        ]}
      />
    ),
  },
  {
    id: "nav",
    title: "NAV",
    body: (
      <>
        <P>NAV per unit = (cash + value of open positions) ÷ units outstanding. It starts at ₹10.0000.</P>
        <List
          items={[
            "The admin strikes the official NAV after the market closes, using recorded closing prices for every open position.",
            "It cannot be struck while a price is missing or an intraday position is still open.",
            "Contributions and withdrawals waiting for that day are finalized at it.",
            "An official NAV is never edited. A correction is a new version, with a reason, and the old one is kept.",
          ]}
        />
      </>
    ),
  },
  {
    id: "watchlist",
    title: "Watchlist",
    body: (
      <P>
        Shared research notes on equities and derivative contracts the pool is watching, with a stage (idea, watching, active…) and comments. It is for the
        pool&apos;s own discussion only, not a recommendation, and it never affects accounting.
      </P>
    ),
  },
  {
    id: "reports",
    title: "Reports",
    body: (
      <List
        items={[
          "Daily report: the day's NAV, trades and flows.",
          "NAV history.",
          "Member statement: your contributions, withdrawals, units and value.",
          "P&L and exposure: realized and unrealized P&L, charges and exposure by product.",
          "Tax estimate: an informational capital-gains estimate for equity delivery only. It is not tax advice and never affects NAV or units.",
        ]}
      />
    ),
  },
  {
    id: "audit",
    title: "Audit",
    body: (
      <P>
        Every change (approvals, trades, corrections, prices, NAVs, settings) is recorded in the audit trail with who, when, the values before and after, and the
        reason where one is required. The audit trail and the money ledger are append-only: mistakes are corrected with new entries, never by editing history.
        Admins and managers can review the trail on the Audit page.
      </P>
    ),
  },
  {
    id: "deletion",
    title: "Deleting a pool",
    body: (
      <P>
        Only an admin can delete a pool, by typing its name to confirm. The pool disappears for every member at once, but all its records are kept for 30 days
        and an admin can restore it from the Pools page during that time. After 30 days it is permanently deleted.
      </P>
    ),
  },
  {
    id: "global-watch",
    title: "Research and Global Watch",
    body: (
      <P>
        The pool&apos;s Watchlist holds research notes for this pool only. Useful findings for everyone (an announcement, an article, a risk) belong in Global
        Watch, which every QFinera member can read. Neither is a buy or sell signal.
      </P>
    ),
  },
];

/** The guide itself, with its table of contents. Used in a pool and from Learn. */
export function PoolGuideContent() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] [&>*]:min-w-0">
      <nav aria-label="Guide contents" className="lg:sticky lg:top-24 lg:self-start">
        <ol className="flex gap-1.5 overflow-x-auto pb-1 text-[13.5px] [scrollbar-width:none] lg:block lg:space-y-1 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                className="block rounded-full border border-[var(--qf-line)] px-3 py-1.5 text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)] lg:rounded-none lg:border-0 lg:px-0 lg:py-0.5 lg:underline-offset-2 lg:hover:underline"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <SectionCard title={s.title}>
              <div className="space-y-3">{s.body}</div>
            </SectionCard>
          </section>
        ))}
        <Disclaimer>QFinera records the pool&apos;s own decisions. It does not give investment, legal or tax advice.</Disclaimer>
      </div>
    </div>
  );
}

export function GuideView() {
  return (
    <>
      <PageHeader eyebrow="Pool Guide" title="How this pool works" description="Roles, money in and out, NAV, trades and approvals, in plain language." />
      <PoolGuideContent />
    </>
  );
}
