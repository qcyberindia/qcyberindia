import ConceptReveal from "@/components/qfinance/learning/ConceptReveal";
import { ShieldAlert } from "lucide-react";

export default function CommunityGuidelines() {
  return (
    <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5">
      <div className="flex items-start gap-2.5">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[var(--qf-brass)]" />
        <div>
          <p className="font-display text-[15px] font-semibold text-[var(--qf-ink)]">
            Ask before you invest.
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">
            Confused about stocks, mutual funds, demat accounts, SIPs, risk, or fees? Ask a question.
            Learn from other beginners. Keep the conversation useful.
          </p>
        </div>
      </div>

      <ConceptReveal prompt="Community guidelines">
        <div className="space-y-3">
          <div>
            <p className="text-[13px] font-semibold text-[var(--qf-up)]">Welcome here</p>
            <p className="mt-1 text-[13.5px] leading-relaxed">
              Beginner questions, educational discussions, explaining concepts, sharing what you learned,
              asking about terminology, general investing principles.
            </p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--qf-down)]">Not allowed</p>
            <p className="mt-1 text-[13.5px] leading-relaxed">
              Guaranteed-return claims, pump-and-dump behavior, personalized buy/sell instructions
              presented as certainty, spam or referral links, scams, harassment, impersonation, sharing
              private information, or asking for passwords/OTPs/account credentials.
            </p>
          </div>
          <p className="text-[13.5px] leading-relaxed">
            Community discussions are for learning and clarification, not personalized financial advice.
            Never share your OTP, password, PAN, Aadhaar, bank details, or broker credentials here.
          </p>
        </div>
      </ConceptReveal>
    </div>
  );
}
