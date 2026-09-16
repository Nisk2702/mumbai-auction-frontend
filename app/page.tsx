"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://YOUR_RENDER_BACKEND_URL";

// ---------------------------------------------------------------------
// TYPES — mirror AuctionController.AuctionListResponse from the Java backend
// ---------------------------------------------------------------------
interface AuctionProperty {
  id: number;
  propertyId: string;
  locality: string;
  submarket: "SOUTH_MUMBAI" | "WESTERN_SUBURBS" | "CENTRAL_MUMBAI";
  bankName: string;
  reservePrice: number;
  emdAmount: number;
  emdLastDate: string | null;
  auctionStartDate: string | null;
  auctionEndDate: string | null;
  propertyType: string;
  reraRegistered: boolean;
  reraNumber: string | null;
  legalEncumbrances: string | null;
  rawNoticeUrl: string | null;
  aiInsights: {
    summary?: string;
    rationale?: string;
    riskIndex?: number;
    valuationGapPct?: number;
    marketPriceEstimateInr?: number;
    generatedAt?: string;
  } | null;
  createdAt: string;
}

interface AuctionListResponse {
  content: AuctionProperty[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

const REGION_LABELS: Record<string, string> = {
  ALL: "All Mumbai Regions",
  SOUTH_MUMBAI: "South Mumbai",
  WESTERN_SUBURBS: "Western Suburbs",
  CENTRAL_MUMBAI: "Central Mumbai",
};

// Thresholds driving the "High Risk" / "Under Value" badges
const HIGH_RISK_THRESHOLD = 55;      // riskIndex >= this => High Risk badge
const UNDER_VALUE_THRESHOLD = 28;    // valuationGapPct >= this => Under Value badge

function formatInrCrore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MumbaiAuctionsDashboardPage() {
  const [auctions, setAuctions] = useState<AuctionProperty[]>([]);
  const [metrics, setMetrics] = useState<{ total: number; avgGap: number; avgRisk: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [searchLocality, setSearchLocality] = useState<string>("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (regionFilter !== "ALL") params.set("submarket", regionFilter);
      if (searchLocality) params.set("locality", searchLocality);
      params.set("page", String(page));
      params.set("size", "20");

      const res = await fetch(`${API_BASE_URL}/api/v1/auctions?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Account-Id": "00000000-0000-0000-0000-000000000001",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Backend responded with ${res.status}`);
      }

      const data: AuctionListResponse = await res.json();
      const rows = data.content ?? [];
      setAuctions(rows);
      setTotalPages(data.totalPages ?? 1);
      const avgGap = rows.length ? rows.reduce((s, a) => s + (a.aiInsights?.valuationGapPct ?? 0), 0) / rows.length : 0;
      const avgRisk = rows.length ? rows.reduce((s, a) => s + (a.aiInsights?.riskIndex ?? 0), 0) / rows.length : 0;
      setMetrics({ total: data.totalElements ?? 0, avgGap, avgRisk });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to load auctions: ${err.message}. Check NEXT_PUBLIC_API_URL and the backend's ALLOWED_CORS_ORIGIN.`
          : "Failed to load auctions."
      );
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  }, [regionFilter, searchLocality, page]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  const headerMetrics = useMemo(
    () => [
      {
        label: "Total Mumbai Auctions",
        value: metrics ? metrics.total.toLocaleString("en-IN") : "—",
        accent: "text-indigo-600",
      },
      {
        label: "Avg. Property Discount Rate",
        value: metrics ? `${metrics.avgGap.toFixed(1)}%` : "—",
        accent: "text-emerald-600",
      },
      {
        label: "Avg. AI Risk Index",
        value: metrics ? metrics.avgRisk.toFixed(1) : "—",
        accent: metrics && metrics.avgRisk > 50 ? "text-red-600" : "text-amber-600",
      },
      {
        label: "Listings on This Page",
        value: auctions.length.toLocaleString("en-IN"),
        accent: "text-slate-700",
      },
    ],
    [metrics, auctions.length]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      {/* ---------------- Page Header ---------------- */}
      <div className="mb-8 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
          Mumbai Bank Auction Intelligence
        </h1>
        <p className="text-sm text-slate-500">
          Live aggregated distress-sale listings across South Mumbai, Western Suburbs, and
          Central Mumbai — enriched with AI risk indexing and valuation-gap analysis.
        </p>
      </div>

      {/* ---------------- Executive Metrics Grid ---------------- */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {headerMetrics.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{m.label}</p>
            <p className={`mt-2 text-3xl font-semibold ${m.accent}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ---------------- Filters ---------------- */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Region</label>
          <select
            value={regionFilter}
            onChange={(e) => {
              setPage(0);
              setRegionFilter(e.target.value);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {Object.entries(REGION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

<div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Locality Search</label>
          <input
            type="text"
            placeholder="e.g. Bandra, Powai, Worli, Thane"
            value={searchLocality}
            onChange={(e) => {
              setPage(0);
              setSearchLocality(e.target.value);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <button
          onClick={() => fetchAuctions()}
          className="mt-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 lg:mt-5"
        >
          Refresh
        </button>
      </div>

{/* ---------------- Error State ---------------- */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ---------------- Listings Table ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Locality",
                  "Bank",
                  "Reserve Price",
                  "Property Type",
                  "Discount",
                  "Risk Index",
                  "RERA",
                  "Auction Date",
                  "Signals",
                  "Notice",
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    Loading Mumbai auction listings...
                  </td>
                </tr>
              )}

              {!loading && auctions.length === 0 && !error && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    No auctions match the current filters.
                  </td>
                </tr>
              )}

              {!loading &&
                auctions.map((a) => {
                  const riskIndex = a.aiInsights?.riskIndex ?? 0;
                  const valuationGapPct = a.aiInsights?.valuationGapPct ?? 0;
                  const isHighRisk = riskIndex >= HIGH_RISK_THRESHOLD;
                  const isUnderValue = valuationGapPct >= UNDER_VALUE_THRESHOLD;

                  return (
                    <tr key={a.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="font-medium text-slate-800">{a.locality}</div>
                        <div className="text-xs text-slate-400">
                          {REGION_LABELS[a.submarket] ?? a.submarket}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{a.bankName}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                        {formatInrCrore(a.reservePrice)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {a.propertyType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {valuationGapPct ? `${valuationGapPct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {riskIndex ? `${riskIndex.toFixed(0)} / 100` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {a.reraRegistered ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                            Registered
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                            Unregistered
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {a.auctionStartDate ? formatDate(a.auctionStartDate) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {isHighRisk && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                              High Risk
                            </span>
                          )}
                          {isUnderValue && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              Under Value
                            </span>
                          )}
                          {!isHighRisk && !isUnderValue && (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {a.rawNoticeUrl ? (
                          <a href={a.rawNoticeUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline">Notice</a>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* ---------------- Pagination ---------------- */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-400">
            Page {page + 1} of {Math.max(totalPages, 1)}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
