import { Outlet, NavLink, Link } from "react-router-dom";
import { MessageSquareText, FileText, ImagePlus, Sparkles, ArrowLeft } from "lucide-react";

const navItems = [
  { to: "paper", label: "Question Paper", icon: FileText, testid: "nav-paper" },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 px-5 flex items-center border-b border-slate-200">
          <Link to="/" className="flex items-center gap-2" data-testid="sidebar-logo">
            <div className="w-7 h-7 bg-black flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-black tracking-tight">INK Education <span className="text-blue-600">AI</span></span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <div className="label px-2 pt-3 pb-2">Workspace</div>
          {navItems.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-sm transition-colors ${
                  isActive
                    ? "bg-black text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
