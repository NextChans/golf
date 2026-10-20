import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "운영자 홈", robots: { index: false } };

export default function AdminHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">운영자 홈</h1>
      <Card>
        <CardHeader><CardTitle>요청 인박스</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">부킹 요청 인박스는 M4에서 열립니다.</CardContent>
      </Card>
    </div>
  );
}
