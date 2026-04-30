import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
    LayoutDashboard, Trophy, Users, BarChart3, Wallet, Spade,
    Settings2, LogOut, Menu, X, Diamond, ShieldCheck, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/torneios", label: "Torneios", icon: Trophy },
    { to: "/jogadores", label: "Jogadores", icon: Users },
    { to: "/ranking", label: "Ranking", icon: BarChart3 },
    { to: "/caixa", label: "Caixa", icon: Wallet },
    { to: "/cash-games", label: "Cash Games", icon: Spade },
    { to: "/rake-report", label: "Relatório Rake", icon: FileText },
    { to: "/dealers", label: "Equipe (Dealers)", icon: Users },
];

const ADMIN_NAV = [
    { to: "/pontuacao", label: "Pontuação", icon: Diamond },
    { to: "/usuarios", label: "Usuários", icon: ShieldCheck },
];

export const AppLayout = () => {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const [houseName, setHouseName] = useState("Casa Royale");
    const navigate = useNavigate();

    React.useEffect(() => {
        api.get("/config").then(({ data }) => {
            if (data.house_name) setHouseName(data.house_name);
        }).catch(() => {});
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    const NavItems = ({ onClick }) => (
        <>
            <div className="px-3 mb-2 mt-6 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Operação</div>
            {NAV.map(({ to, label, icon: Icon }) => (
                <NavLink
                    key={to}
                    to={to}
                    onClick={onClick}
                    data-testid={`nav-${to.replace("/", "")}`}
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                            isActive
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                        )
                    }
                >
                    <Icon className="size-4" strokeWidth={1.6} />
                    {label}
                </NavLink>
            ))}
            {user?.role === "admin" && (
                <>
                    <div className="px-3 mb-2 mt-6 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Administração</div>
                    {ADMIN_NAV.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            onClick={onClick}
                            data-testid={`nav-${to.replace("/", "")}`}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                )
                            }
                        >
                            <Icon className="size-4" strokeWidth={1.6} />
                            {label}
                        </NavLink>
                    ))}
                </>
            )}
        </>
    );

    return (
        <div className="min-h-screen felt grid-bg flex">
            {/* Sidebar — desktop */}
            <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/5 bg-surface/80 backdrop-blur-xl">
                <div className="px-5 pt-6 pb-2 flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                        <Spade className="size-5 text-primary" strokeWidth={2} />
                    </div>
                    <div>
                        <div className="font-heading font-bold tracking-tight text-lg leading-none">{houseName}</div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">Poker Manager</div>
                    </div>
                </div>
                <nav className="flex-1 px-3 pt-2 overflow-y-auto scrollbar-thin">
                    <NavItems />
                </nav>
                <div className="p-3 border-t border-white/5">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
                        <div className="size-9 rounded-full bg-gradient-to-br from-primary to-amber-700 flex items-center justify-center font-bold text-primary-foreground">
                            {user?.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" data-testid="user-name">{user?.name}</div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{user?.role}</div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleLogout}
                            data-testid="logout-button"
                            className="text-muted-foreground hover:text-destructive"
                        >
                            <LogOut className="size-4" strokeWidth={1.6} />
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Mobile sidebar */}
            {open && (
                <div className="lg:hidden fixed inset-0 z-50 flex">
                    <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
                    <aside className="relative w-72 bg-surface border-r border-white/10 flex flex-col">
                        <div className="flex items-center justify-between px-5 pt-5">
                            <div className="flex items-center gap-2">
                                <Spade className="size-5 text-primary" strokeWidth={2} />
                                <span className="font-heading font-bold">{houseName}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} data-testid="close-sidebar">
                                <X className="size-4" />
                            </Button>
                        </div>
                        <nav className="flex-1 px-3 pt-2 overflow-y-auto">
                            <NavItems onClick={() => setOpen(false)} />
                        </nav>
                        <div className="p-3 border-t border-white/5">
                            <Button variant="ghost" className="w-full justify-start" onClick={handleLogout} data-testid="logout-button-mobile">
                                <LogOut className="size-4 mr-2" /> Sair
                            </Button>
                        </div>
                    </aside>
                </div>
            )}

            {/* Main */}
            <div className="flex-1 min-w-0 flex flex-col">
                {/* Topbar mobile */}
                <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-white/5 bg-surface/80 backdrop-blur-xl">
                    <Button variant="ghost" size="icon" onClick={() => setOpen(true)} data-testid="open-sidebar">
                        <Menu className="size-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <Spade className="size-4 text-primary" />
                        <span className="font-heading font-bold tracking-tight">{houseName}</span>
                    </div>
                    <div className="size-9" />
                </header>
                <main className="flex-1 min-w-0 overflow-x-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AppLayout;
