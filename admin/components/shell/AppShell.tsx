import { Sidebar } from "./Sidebar";

export function AppShell({ adminEmail, children }: { adminEmail: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar adminEmail={adminEmail} />
      <main className="ml-64 min-h-screen px-8 py-8">{children}</main>
    </div>
  );
}
