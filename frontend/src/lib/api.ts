const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type Project = {
    id: string;
    name: string;
    description: string;
    url: string;
};

export type Portfolio = {
    id: string;
    name: string;
    description?: string | null;
    symbols: string[];
    allocationPercent: number;
    allocations: Record<string, number>;
    startDate: string;
    createdAt: string;
    updatedAt: string;
};

export type PortfolioListResponse = {
    portfolios: Portfolio[];
};

export type PortfolioPayload = {
    name: string;
    description?: string | null;
    symbols: string[];
    allocation_percent: number;
    start_date?: string;
    allocations?: Record<string, number>;
};

export type TickerQuote = {
    symbol: string;
    price: number | null;
    exchange: string | null;
    timestamp: string | null;
    conditions: string[] | null;
    weight: number | null;
};

export type PortfolioSnapshot = {
    portfolio: Portfolio;
    quotes: TickerQuote[];
};

export type PortfolioHistoryPoint = {
    date: string;
    value: number;
    components: Record<string, number>;
};

export type PortfolioHistory = {
    portfolio: Portfolio;
    startDate: string;
    endDate: string;
    history: PortfolioHistoryPoint[];
};
export type AlpacaStatus = {
    feedEnabled: boolean;
    hasCredentials: boolean;
    accountId: string | null;
    symbols: string[];
    pollIntervalSeconds: number;
    portfolioCount: number;
    totalAllocationPercent: number;
};

export async function fetchProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
        next: { revalidate: 60 },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data: { projects: Project[] } = await response.json();
    return data.projects;
}

export async function fetchPortfolios(): Promise<PortfolioListResponse> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios`, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch portfolios: ${response.statusText}`);
    }

    const data = (await response.json()) as PortfolioListResponse;
    return data;
}

export async function fetchAlpacaStatus(): Promise<AlpacaStatus> {
    const response = await fetch(`${API_BASE_URL}/api/alpaca/status`, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Alpaca status: ${response.statusText}`);
    }

    const data = (await response.json()) as AlpacaStatus;
    return data;
}

export async function createPortfolio(payload: PortfolioPayload): Promise<Portfolio> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create portfolio: ${errorText}`);
    }

    const data = (await response.json()) as { portfolio: Portfolio };
    return data.portfolio;
}

export async function updatePortfolio(
    portfolioId: string,
    payload: Partial<PortfolioPayload>
): Promise<Portfolio> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios/${portfolioId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update portfolio: ${errorText}`);
    }

    const data = (await response.json()) as { portfolio: Portfolio };
    return data.portfolio;
}

export async function deletePortfolio(portfolioId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios/${portfolioId}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete portfolio: ${errorText}`);
    }
}

export async function fetchPortfolio(id: string): Promise<Portfolio> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios/${id}`, {
        cache: "no-store",
    });

    if (response.status === 404) {
        throw new Error('Portfolio not found');
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch portfolio: ${errorText}`);
    }

    const data = (await response.json()) as { portfolio: Portfolio };
    return data.portfolio;
}

export async function fetchPortfolioSnapshot(id: string): Promise<PortfolioSnapshot> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios/${id}/snapshot`, {
        cache: "no-store",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch portfolio snapshot: ${errorText}`);
    }

    const data = (await response.json()) as PortfolioSnapshot;
    return data;
}

export async function fetchPortfolioHistory(id: string, startDate: string): Promise<PortfolioHistory> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios/${id}/history?startDate=${encodeURIComponent(startDate)}`, {
        cache: "no-store",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch portfolio history: ${errorText}`);
    }

    const data = (await response.json()) as PortfolioHistory;
    return data;
}
