import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { fmtBRL, fmtDateTime, fmtNumber, fmtDate } from "@/lib/format";
import { ArrowLeft, Trophy, Wallet, Coins, Star, AlertTriangle } from "lucide-react";

export default function PlayerProfile() {
    const { id } = useParams();
    const [data, setData] = useState(null);

    useEffect(() => {
        (async () => {
            const { data } = await api.get(`/players/${id}/profile`);
            setData(data);
        })();
    }, [id]);

    if (!data) return <div className="p-8 text-muted-foreground">Carregando...</div>;
    const { player, entries, transactions, stats } = data;

    return (
        <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
            <Link to="/jogadores" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-6">
                <ArrowLeft className="size-4" /> Voltar para jogadores
            </Link>

            <div className="rounded-2xl bg-surface border border-white/5 p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="size-20 rounded-2xl bg-gradient-to-br from-primary to-amber-700 flex items-center justify-center font-heading font-bold text-3xl text-primary-foreground">
                    {player.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-1">Jogador</div>
                    <h1 className="text-3xl font-heading font-bold tracking-tight">{player.name}</h1>
                    <div className="text-sm text-muted-foreground mt-1">
                        {player.email || "Sem e-mail"} · {player.phone || "Sem telefone"} · Desde {fmtDate(player.created_at)}
                    </div>
                    {player.notes && <div className="text-sm text-muted-foreground mt-2 italic">"{player.notes}"</div>}
                </div>
                {stats.debt_balance > 0 && (
                    <div className="rounded-xl px-4 py-3 bg-destructive/10 border border-destructive/30 text-right">
                        <div className="text-[10px] uppercase tracking-widest text-destructive">Dívida</div>
                        <div className="font-mono text-xl font-bold text-destructive">{fmtBRL(stats.debt_balance)}</div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Stat icon={Trophy} label="Torneios" value={fmtNumber(stats.total_entries)} />
                <Stat icon={Coins} label="Total Investido" value={fmtBRL(stats.total_spent)} />
                <Stat icon={Wallet} label="Total Premiado" value={fmtBRL(stats.total_won)} />
                <Stat icon={Star} label="Pontos" value={fmtNumber(stats.total_points)} accent={stats.roi >= 0 ? "success" : "destructive"} sub={`ROI ${stats.roi >= 0 ? "+" : ""}${fmtBRL(stats.roi)}`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-surface border border-white/5 p-6">
                    <h3 className="font-heading text-lg font-semibold mb-4">Histórico de torneios</h3>
                    <div className="space-y-2">
                        {entries.length === 0 && <div className="text-sm text-muted-foreground">Sem inscrições ainda.</div>}
                        {entries.map((e) => (
                            <Link to={`/torneios/${e.tournament_id}`} key={e.id} className="block rounded-lg p-3 bg-surface-elevated border border-white/5 hover:border-primary/30 transition-colors">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-semibold truncate">{e.tournament_name}</div>
                                        <div className="text-xs text-muted-foreground">{e.tournament_type} · {fmtDate(e.created_at)}</div>
                                    </div>
                                    <div className="text-right">
                                        {e.final_position && <div className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 inline-block">#{e.final_position}</div>}
                                        <div className="text-xs text-muted-foreground mt-1 font-mono">{fmtBRL(e.total_spent)}</div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl bg-surface border border-white/5 p-6">
                    <h3 className="font-heading text-lg font-semibold mb-4">Transações</h3>
                    <div className="space-y-2">
                        {transactions.length === 0 && <div className="text-sm text-muted-foreground">Sem transações ainda.</div>}
                        {transactions.slice(0, 20).map((t) => (
                            <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{t.description || t.type}</div>
                                    <div className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)} · {t.payment_method}</div>
                                </div>
                                <div className={`font-mono text-sm ${t.type === "debt_payment" || t.type === "manual_in" ? "text-success" : t.type === "debt_added" ? "text-destructive" : ""}`}>
                                    {t.type === "debt_payment" ? "−" : t.type === "debt_added" ? "+" : ""}{fmtBRL(t.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const Stat = ({ icon: Icon, label, value, sub, accent = "primary" }) => (
    <div className="rounded-2xl bg-surface border border-white/5 p-5">
        <div className="flex items-start justify-between">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
            <div className={`size-9 rounded-lg flex items-center justify-center bg-${accent}/10 border border-${accent}/20`}>
                <Icon className={`size-4 text-${accent}`} strokeWidth={1.6} />
            </div>
        </div>
        <div className="mt-3 font-heading text-2xl font-bold tracking-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
);
