"use client";

import Reveal from "@/components/Reveal";
import CuriosityModule from "@/components/qfinance/CuriosityModule";
import BuyScene from "@/components/qfinance/scenes/BuyScene";

/**
 * Client-side home for the C1 curiosity module. This exists as its own
 * component (rather than living inline in the Server Component page) because
 * CuriosityModule's `scene` prop is a function — functions can't be passed
 * from a Server Component to a Client Component in the App Router. Building
 * the closure here, entirely on the client, avoids that boundary crossing.
 */
export default function BeginnerJourneyC1() {
  return (
    <Reveal>
      <CuriosityModule
        eyebrow="Buying"
        question="Wait, who am I buying from?"
        hook="You just pressed BUY — ₹1,000 for 10 shares. Who do you think is actually selling these shares to you?"
        choices={["The company", "Another investor", "My broker", "The stock exchange"]}
        correctIndex={1}
        sceneLabel="Order flow: You → Broker → Exchange → Seller"
        viewBox="0 0 640 380"
        mobileViewBox="0 0 340 480"
        gateRevealOnSceneComplete
        scene={({ play, reduceMotion, isMobile, onComplete }) => (
          <BuyScene play={play} reduceMotion={reduceMotion} isMobile={isMobile} onComplete={onComplete} />
        )}
        textEquivalent={
          <ol className="list-decimal space-y-2 pl-5">
            <li>You place a buy order for 10 shares through your broker.</li>
            <li>Your broker routes the order to the stock exchange.</li>
            <li>The exchange matches your buy order against a seller&apos;s order already sitting in the order book.</li>
            <li>That seller is typically another investor — not the company, not the broker, and not the exchange itself.</li>
          </ol>
        }
        concept={
          <p>
            For a normal secondary-market trade, you&apos;re buying from <b>another investor</b> who
            wants to sell — not from the company itself.
          </p>
        }
        explanation={
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-3.5">
                <p className="font-display text-sm font-semibold text-[var(--qf-ink)]">Primary market</p>
                <p className="mt-1 text-[13px] text-[var(--qf-ink-soft)]">Company issues shares → investor.</p>
              </div>
              <div className="rounded-sm border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-3.5">
                <p className="font-display text-sm font-semibold text-[var(--qf-ink)]">Secondary market</p>
                <p className="mt-1 text-[13px] text-[var(--qf-ink-soft)]">Investor → investor, matched by the exchange.</p>
              </div>
            </div>
            <p>
              Almost every app purchase you make is a secondary-market trade — you&apos;re on one side
              of a match, another investor is on the other.
            </p>
          </div>
        }
        nextCuriosity={{
          prompt: "So if the company isn't receiving your ₹1,000… when DOES a company actually get money from investors?",
          cta: "Explore the IPO →",
          href: "/qfinance/beginner",
        }}
      />
    </Reveal>
  );
}
