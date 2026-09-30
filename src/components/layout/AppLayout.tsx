// src/components/layout/AppLayout.tsx
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import QuickActions from "@/components/shared/QuickActions";

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export default function AppLayout({ title, subtitle, children, action }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f0f2f5]">
      {/* Sidebar — fixed left column (fetches its own badge counts) */}
      <Sidebar />

      {/* Main area — scrollable */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} subtitle={subtitle} actions={action} />

        <main id="sw-main-content" className="flex-1 overflow-y-auto">
          {children}
          <QuickActions />
        </main>
      </div>
    </div>
  );
}