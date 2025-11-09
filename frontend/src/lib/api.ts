const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

export type PortfolioSetup = {
    id: string;
    name: string;
    description?: string | null;
    startDate: string;
    endDate: string;
    createdAt: string;
    updatedAt: string;
    portfolioIds: string[];
};

export type PortfolioSetupListResponse = {
    setups: PortfolioSetup[];
};

export type PortfolioSetupPayload = {
    name: string;
    description?: string | null;
    startDate?: string;
    endDate?: string;
};

type PortfolioSetupResponse = {
    setup: PortfolioSetup;
};

export type PortfolioPayload = {
    name: string;
    description?: string | null;
    symbols: string[];
    allocation_percent: number;
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

export type CombinedSnapshot = {
    totalAllocationPercent: number;
    portfolioCount: number;
    earliestStartDate: string | null;
    latestEndDate: string | null;
    symbolAllocations: Record<string, number>;
    quotes: TickerQuote[];
};

export type CombinedHistory = {
    startDate: string;
    endDate: string;
    history: PortfolioHistoryPoint[];
};

export async function fetchSetups(): Promise<PortfolioSetupListResponse> {
    const response = await fetch(`${API_BASE_URL}/api/setups`, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch portfolio setups: ${response.statusText}`);
    }

    const data = (await response.json()) as PortfolioSetupListResponse;
    return data;
}

export async function fetchSetupSnapshot(setupId: string): Promise<CombinedSnapshot> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}/snapshot`, {
        cache: "no-store",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch setup snapshot: ${errorText}`);
    }

    const data = (await response.json()) as CombinedSnapshot;
    return data;
}

export async function fetchSetupHistory(setupId: string, startDate?: string): Promise<CombinedHistory> {
    const url = new URL(`${API_BASE_URL}/api/setups/${setupId}/history`);
    if (startDate) {
        url.searchParams.set("startDate", startDate);
    }

    const response = await fetch(url.toString(), {
        cache: "no-store",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch setup history: ${errorText}`);
    }

    const data = (await response.json()) as CombinedHistory;
    return data;
}

export async function fetchSetup(setupId: string): Promise<PortfolioSetup> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}`, {
        cache: "no-store",
    });

    if (response.status === 404) {
        throw new Error("Setup not found");
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch setup: ${errorText}`);
    }

    const data = (await response.json()) as PortfolioSetupResponse;
    return data.setup;
}

export async function createSetup(payload: PortfolioSetupPayload): Promise<PortfolioSetup> {
    const response = await fetch(`${API_BASE_URL}/api/setups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create setup: ${errorText}`);
    }

    const data = (await response.json()) as PortfolioSetupResponse;
    return data.setup;
}

export async function updateSetup(
    setupId: string,
    payload: Partial<PortfolioSetupPayload>
): Promise<PortfolioSetup> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update setup: ${errorText}`);
    }

    const data = (await response.json()) as PortfolioSetupResponse;
    return data.setup;
}

export async function deleteSetup(setupId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete setup: ${errorText}`);
    }
}

export async function fetchPortfolios(setupId: string): Promise<PortfolioListResponse> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}/portfolios`, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch portfolios for setup: ${response.statusText}`);
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

export async function createPortfolio(setupId: string, payload: PortfolioPayload): Promise<Portfolio> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}/portfolios`, {
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
    setupId: string,
    portfolioId: string,
    payload: Partial<PortfolioPayload>
): Promise<Portfolio> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}/portfolios/${portfolioId}`, {
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

export async function deletePortfolio(setupId: string, portfolioId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}/portfolios/${portfolioId}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete portfolio: ${errorText}`);
    }
}

export async function fetchPortfolio(setupId: string, portfolioId: string): Promise<Portfolio> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}/portfolios/${portfolioId}`, {
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

export async function fetchPortfolioSnapshot(setupId: string, portfolioId: string): Promise<PortfolioSnapshot> {
    const response = await fetch(`${API_BASE_URL}/api/setups/${setupId}/portfolios/${portfolioId}/snapshot`, {
        cache: "no-store",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch portfolio snapshot: ${errorText}`);
    }

    const data = (await response.json()) as PortfolioSnapshot;
    return data;
}

export async function fetchPortfolioHistory(
    setupId: string,
    portfolioId: string,
    startDate: string
): Promise<PortfolioHistory> {
    const response = await fetch(
        `${API_BASE_URL}/api/setups/${setupId}/portfolios/${portfolioId}/history?startDate=${encodeURIComponent(startDate)}`,
        {
        cache: "no-store",
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch portfolio history: ${errorText}`);
    }

    const data = (await response.json()) as PortfolioHistory;
    return data;
}

export async function fetchCombinedSnapshot(): Promise<CombinedSnapshot> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios/combined/snapshot`, {
        cache: "no-store",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch combined snapshot: ${errorText}`);
    }

    const data = (await response.json()) as CombinedSnapshot;
    return data;
}

export async function fetchCombinedHistory(startDate?: string): Promise<CombinedHistory> {
    const url = new URL(`${API_BASE_URL}/api/portfolios/combined/history`);
    if (startDate) {
        url.searchParams.set("startDate", startDate);
    }

    const response = await fetch(url.toString(), {
        cache: "no-store",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch combined history: ${errorText}`);
    }

    const data = (await response.json()) as CombinedHistory;
    return data;
}

export async function updateCombinedStartDate(startDate: string): Promise<CombinedSnapshot> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios/combined/start-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update combined start date: ${errorText}`);
    }

    const data = (await response.json()) as CombinedSnapshot;
    return data;
}

export async function updateCombinedEndDate(endDate: string): Promise<CombinedSnapshot> {
    const response = await fetch(`${API_BASE_URL}/api/portfolios/combined/end-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endDate }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update combined end date: ${errorText}`);
    }

    const data = (await response.json()) as CombinedSnapshot;
    return data;
}
