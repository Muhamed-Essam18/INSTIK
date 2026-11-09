import Link from "next/link";
import { pricing } from "@/lib/marketing/copy";
import { waitlistPath } from "@/lib/routes";

export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="flex flex-col gap-4">
      <h2 id="faq-title" className="font-display text-[28px] leading-[34px] font-extrabold">
        {pricing.faqTitle}
      </h2>
      {pricing.faqs.map((faq) => (
        <details key={faq.q} className="rounded-lg bg-paper px-6 py-5">
          <summary className="min-h-6 cursor-pointer text-[17px] font-semibold">{faq.q}</summary>
          <p className="mt-3 text-[16px] leading-[25px] text-slate">
            {faq.a}
            {"link" in faq && (
              <>
                {" "}
                <Link href={waitlistPath()} className="font-semibold">
                  {faq.link}
                </Link>
                .
              </>
            )}
          </p>
        </details>
      ))}
    </section>
  );
}
