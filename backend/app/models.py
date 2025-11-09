from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class PortfolioBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    symbols: List[str] = Field(default_factory=list)


class PortfolioCreate(PortfolioBase):
    allocation_percent: float = Field(
        ..., ge=0.0, le=1.0, serialization_alias="allocationPercent"
    )
    start_date: Optional[datetime] = Field(default=None, serialization_alias="startDate")
    allocations: Optional[Dict[str, float]] = Field(default=None, serialization_alias="allocations")


class PortfolioUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    symbols: Optional[List[str]] = Field(default=None)
    allocations: Optional[Dict[str, float]] = Field(default=None, serialization_alias="allocations")
    start_date: Optional[datetime] = Field(default=None, serialization_alias="startDate")
    allocation_percent: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, serialization_alias="allocationPercent"
    )


class Portfolio(PortfolioBase):
    id: str
    allocation_percent: float = Field(serialization_alias="allocationPercent")
    allocations: Dict[str, float] = Field(default_factory=dict, serialization_alias="allocations")
    start_date: datetime = Field(serialization_alias="startDate")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class PortfolioListResponse(BaseModel):
    portfolios: List[Portfolio]


class PortfolioResponse(BaseModel):
    portfolio: Portfolio


class TickerPrice(BaseModel):
    symbol: str
    price: Optional[float] = None
    exchange: Optional[str] = None
    timestamp: Optional[datetime] = Field(default=None, serialization_alias="timestamp")
    conditions: Optional[List[str]] = None
    weight: Optional[float] = None


class PortfolioSnapshotResponse(BaseModel):
    portfolio: Portfolio
    quotes: List[TickerPrice]


class PortfolioHistoryPoint(BaseModel):
    date: datetime = Field(serialization_alias="date")
    value: float
    components: Dict[str, float]


class PortfolioHistoryResponse(BaseModel):
    portfolio: Portfolio
    start_date: datetime = Field(serialization_alias="startDate")
    end_date: datetime = Field(serialization_alias="endDate")
    history: List[PortfolioHistoryPoint]


class PortfolioSetup(BaseModel):
    id: str
    name: str = Field(..., min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=500)
    start_date: datetime = Field(serialization_alias="startDate")
    end_date: datetime = Field(serialization_alias="endDate")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")
    portfolio_ids: List[str] = Field(default_factory=list, serialization_alias="portfolioIds")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class PortfolioSetupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=500)
    start_date: Optional[datetime] = Field(default=None, serialization_alias="startDate")
    end_date: Optional[datetime] = Field(default=None, serialization_alias="endDate")


class PortfolioSetupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    description: Optional[str] = Field(default=None, max_length=500)
    start_date: Optional[datetime] = Field(default=None, serialization_alias="startDate")
    end_date: Optional[datetime] = Field(default=None, serialization_alias="endDate")


class PortfolioSetupResponse(BaseModel):
    setup: PortfolioSetup


class PortfolioSetupListResponse(BaseModel):
    setups: List[PortfolioSetup]


class CombinedSnapshotResponse(BaseModel):
    total_allocation_percent: float = Field(serialization_alias="totalAllocationPercent")
    portfolio_count: int = Field(serialization_alias="portfolioCount")
    earliest_start_date: Optional[datetime] = Field(default=None, serialization_alias="earliestStartDate")
    latest_end_date: Optional[datetime] = Field(default=None, serialization_alias="latestEndDate")
    symbol_allocations: Dict[str, float] = Field(default_factory=dict, serialization_alias="symbolAllocations")
    quotes: List[TickerPrice] = Field(default_factory=list)


class CombinedHistoryResponse(BaseModel):
    start_date: datetime = Field(serialization_alias="startDate")
    end_date: datetime = Field(serialization_alias="endDate")
    history: List[PortfolioHistoryPoint]
