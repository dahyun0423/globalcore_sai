"use client";

import dynamic from "next/dynamic";

// 데이터가 전부 폰(localStorage·IndexedDB)에 있어서 서버 렌더링 없이 띄운다
const AppShell = dynamic(() => import("./AppShell").then((m) => m.AppShell), {
  ssr: false,
  loading: () => <div className="h-[100dvh] bg-bg" />,
});

export function ClientApp() {
  return <AppShell />;
}
