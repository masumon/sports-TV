import { Suspense } from "react";
import { ViewerHome } from "@/components/home/ViewerHome";

function HomeLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--bg-dark)" }}
    >
      <div className="loading-spin" aria-hidden />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <ViewerHome />
    </Suspense>
  );
}
