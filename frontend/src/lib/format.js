export const fmtBRL = (n) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

export const fmtNumber = (n) =>
    new Intl.NumberFormat("pt-BR").format(Number(n || 0));

export const fmtDateTime = (iso) => {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch {
        return iso;
    }
};

export const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("pt-BR");
    } catch {
        return iso;
    }
};

export const apiErr = (e) => {
    const detail = e?.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((x) => x?.msg || JSON.stringify(x)).join(" ");
    return e?.message || "Erro inesperado";
};
