import { Flag, MapPin, Star } from "lucide-react";
import type { MarketDetail } from "@/lib/mock/market-detail";

const ICONS = { flag: Flag, "map-pin": MapPin, star: Star } as const;

/** 회원권 특징: 연한 그린 카드 3장 */
export function Features({ features }: { features: MarketDetail["features"] }) {
  return (
    <div>
      <h2 className="text-heading font-extrabold text-ink">회원권 특징</h2>
      <ul className="mt-4 space-y-3">
        {features.map((f) => {
          const Icon = ICONS[f.icon];
          return (
            <li key={f.title} className="rounded-card bg-brand-soft px-5 py-6 text-center">
              <Icon aria-hidden className="mx-auto size-8 text-brand-ink" />
              <h3 className="mt-3 text-subhead font-bold text-brand-ink">{f.title}</h3>
              <p className="mt-2 text-label text-ink-sub">{f.desc}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
