import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { OnboardingForm } from "@/components/onboarding-form";
import { getCurrentBusiness, requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const business = await getCurrentBusiness(user.id);

  if (business) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <BrandMark />
        <OnboardingForm />
      </div>
    </main>
  );
}
