import { QuickInput } from "@/components/quick-input";
import { Card, Muted, PageTitle } from "@/components/ui";

export default function TodayPage() {
  return (
    <>
      <PageTitle>Today</PageTitle>
      <Muted className="mb-6">The plan for the next visit shows here.</Muted>
      <Card>
        <QuickInput />
      </Card>
    </>
  );
}
