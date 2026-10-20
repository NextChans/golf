import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// globals.css의 커스텀 글자 크기 토큰(text-body 등)을 tailwind-merge에 알려준다.
// 알리지 않으면 글자 색 클래스로 오인해 text-primary-foreground 같은 색을 지워 버린다.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "hero-lg", "headline", "title", "eyebrow", "body", "small", "micro"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
