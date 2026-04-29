import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { fmtBRL, fmtNumber } from "@/lib/format";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { Coins, Users2, Spade, Trophy, AlertTriangle, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";

const Stat = ({ icon: Icon, label, value, sub, accent = "primary", testid }) => (
    <div data-testid={testid} className="rounded-2xl bg-surface border border-white/5 p-5 hover:border-white/10 transition-colors">
        <div className="flex items-start justify-between">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
            <div className={`size-9 rounded-lg flex items-center justify-center bg-${accent}/10 border border-${accent}/20`}>
                <Icon className={`size-4 text-${accent}`} strokeWidth={1.6} />
            </div>
        </div>
        <div className="mt-4 font-heading text-3xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
);

export default function Dashboard() {
    const [summary, setSummary] = useState(null);
    const [revenue, setRevenue] = useState([]);
    const [tournaments, setTournaments] = useState([]);

    useEffect(() => {
        (async () => {
            const [s, r, t] = await Promise.all([
                api.get("/dashboard/summary"),
                api.get("/dashboard/revenue?days=7"),
                api.get("/tournaments"),
            ]);
            setSummary(s.data);
            setRevenue(r.data);
            setTournaments(t.data);
        })();
    }, []);

    const ongoing = tournaments.filter((t) => t.status === "in_progress").slice(0, 5);
    const upcoming = tournaments.filter((t) => t.status === "scheduled").slice(0, 5);

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">Operação · Hoje</div>
                    <h1 className="text-4xl font-heading font-bold tracking-tight">Painel Geral</h1>
                    <p className="text-sm text-muted-foreground mt-1">Visão rápida do salão, caixa e torneios em andamento.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <Stat testid="stat-revenue" icon={Coins} label="Receita Hoje" value={fmtBRL(summary?.revenue_today ?? 0)} sub="Pagamentos recebidos" />
                <Stat testid="stat-active-players" icon={Users2} label="Jogadores Ativos" value={fmtNumber(summary?.active_players ?? 0)} sub={`${summary?.total_players ?? 0} cadastrados`} />
                <Stat testid="stat-tables" icon={Spade} label="Mesas Cash Abertas" value={fmtNumber(summary?.open_tables ?? 0)} />
                <Stat testid="stat-tournaments" icon={Trophy} label="Torneios em Andamento" value={fmtNumber(summary?.ongoing_tournaments ?? 0)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl bg-surface border border-white/5 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Últimos 7 dias</div>
                            <div className="font-heading text-xl font-semibold mt-1">Receita Diária</div>
                        </div>
                        <div className="text-sm text-muted-foreground font-mono">{fmtBRL(revenue.reduce((s, r) => s + r.revenue, 0))}</div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenue}>
                                <defs>
                                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(43, 65%, 53%)" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="hsl(43, 65%, 53%)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={(d) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} />
                                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$${v}`} />
                                <Tooltip
                                    contentStyle={{ background: "#12141A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                                    formatter={(v) => [fmtBRL(v), "Receita"]}
                                    labelFormatter={(d) => new Date(d).toLocaleDateString("pt-BR")}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="hsl(43, 65%, 53%)" strokeWidth={2} fill="url(#goldGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl bg-surface border border-white/5 p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <ReceiptText className="size-4 text-primary" />
                            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Caixa</div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">Pendente</div>
                                <div className="font-mono font-semibold">{fmtBRL(summary?.pending_total ?? 0)}</div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">Cobranças abertas</div>
                                <div className="font-mono font-semibold">{summary?.pending_count ?? 0}</div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <AlertTriangle className="size-3.5 text-destructive" /> Dívidas
                                </div>
                                <div className="font-mono font-semibold text-destructive">{fmtBRL(summary?.total_debt ?? 0)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-2xl bg-surface border border-white/5 p-5">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Em andamento</div>
                        <div className="space-y-2">
                            {ongoing.length === 0 && <div className="text-sm text-muted-foreground">Nenhum torneio rolando.</div>}
                            {ongoing.map((t) => (
                                <Link key={t.id} to={`/torneios/${t.id}`} className="block rounded-lg p-2 hover:bg-white/5">
                                    <div className="text-sm font-semibold">{t.name}</div>
                                    <div className="text-xs text-muted-foreground">{t.type}</div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {upcoming.length > 0 && (
                <div className="mt-8 rounded-2xl bg-surface border border-white/5 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Próximos</div>
                            <div className="font-heading text-xl font-semibold mt-1">Torneios Agendados</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {upcoming.map((t) => (
                            <Link
                                key={t.id}
                                to={`/torneios/${t.id}`}
                                data-testid={`upcoming-${t.id}`}
                                className="block rounded-xl p-4 bg-surface-elevated border border-white/5 hover:border-primary/30 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="font-semibold">{t.name}</div>
                                    <div className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{t.type}</div>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    {new Date(t.start_at).toLocaleString("pt-BR")}
                                </div>
                                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>Buy-in: <span className="text-foreground font-mono">{fmtBRL(t.buy_in)}</span></span>
                                    <span>Rake: <span className="text-foreground font-mono">{fmtBRL(t.rake)}</span></span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
