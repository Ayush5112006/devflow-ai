import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Asset } from '../../types';
import { RiskBadge, StatusBadge } from '../ui/StatusBadge';

// ─────────────────────────────────────────────────────────────────────────────
// CSV Export helper
// ─────────────────────────────────────────────────────────────────────────────

export function exportAssetsToCSV(assets: Asset[]) {
  const headers = [
    'Rank', 'Asset ID', 'Name', 'Type', 'Zone', 'Risk Score', 'Risk Level',
    'Status', 'Customers Served', 'Last Inspected', 'Next Maintenance',
    '7d Failure %',
  ];
  const rows = assets
    .slice()
    .sort((a, b) => b.risk_score - a.risk_score)
    .map((a, i) => [
      i + 1,
      a.id,
      `"${a.name}"`,
      a.type,
      a.zone,
      a.risk_score,
      a.risk_level,
      a.status,
      a.customers_served,
      a.last_inspected,
      a.next_maintenance,
      Math.round(a.failure_probability_7d * 100) + '%',
    ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gridguard-assets-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Table
// ─────────────────────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<Asset & { rank: number }>();

const columns = [
  columnHelper.accessor('rank', {
    header: '#',
    cell: (info) => (
      <span className="font-mono text-xs text-slate-500 font-semibold">
        {String(info.getValue()).padStart(2, '0')}
      </span>
    ),
    enableSorting: false,
  }),
  columnHelper.accessor('id', {
    header: 'Asset ID',
    cell: (info) => (
      <Link
        to={`/assets/${info.getValue()}`}
        className="font-mono text-xs text-brand-400 hover:text-brand-300 hover:underline
                   flex items-center gap-1 transition-colors"
      >
        {info.getValue()} <ExternalLink size={10} />
      </Link>
    ),
  }),
  columnHelper.accessor('type', {
    header: 'Type',
    cell: (info) => (
      <span className="text-xs text-slate-400 capitalize">
        {info.getValue().replace('_', ' ')}
      </span>
    ),
  }),
  columnHelper.accessor('zone', {
    header: 'Zone',
    cell: (info) => (
      <span className="text-xs font-medium text-slate-300">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('risk_score', {
    header: 'Risk Score',
    cell: (info) => {
      const score = info.getValue();
      const color =
        score >= 85 ? '#ef4444' : score >= 70 ? '#f97316' : score >= 45 ? '#eab308' : '#22c55e';
      return (
        <div className="flex items-center gap-2 min-w-[110px]">
          <div className="flex-1 h-1.5 rounded-full bg-navy-900 overflow-hidden">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${score}%`, background: color }}
            />
          </div>
          <span className="text-xs font-mono font-bold w-6 text-right" style={{ color }}>
            {score}
          </span>
        </div>
      );
    },
  }),
  columnHelper.accessor('risk_level', {
    header: 'Risk Level',
    cell: (info) => <RiskBadge level={info.getValue()} />,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} size="sm" />,
  }),
  columnHelper.accessor('customers_served', {
    header: 'Customers',
    cell: (info) => (
      <span className="text-xs text-slate-300 font-mono">
        {info.getValue().toLocaleString()}
      </span>
    ),
  }),
  columnHelper.accessor('last_inspected', {
    header: 'Last Inspected',
    cell: (info) => <span className="text-xs text-slate-400">{info.getValue()}</span>,
  }),
  columnHelper.accessor('failure_probability_7d', {
    header: '7d Failure',
    cell: (info) => {
      const pct = Math.round(info.getValue() * 100);
      return (
        <span className={`text-xs font-mono font-bold ${pct >= 60 ? 'text-red-400' : pct >= 35 ? 'text-orange-400' : 'text-slate-400'}`}>
          {pct}%
        </span>
      );
    },
  }),
  columnHelper.display({
    id: 'action',
    header: 'Action',
    cell: (info) => (
      <Link
        to={`/assets/${info.row.original.id}`}
        className="text-xs text-brand-400 hover:text-brand-300 hover:underline transition-colors"
      >
        Details →
      </Link>
    ),
  }),
];

interface AssetRiskTableProps {
  assets: Asset[];
}

export function AssetRiskTable({ assets }: AssetRiskTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'risk_score', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const rankedAssets = useMemo(
    () =>
      [...assets]
        .sort((a, b) => b.risk_score - a.risk_score)
        .map((a, i) => ({ ...a, rank: i + 1 })),
    [assets],
  );

  const table = useReactTable({
    data: rankedAssets,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Search by ID, name, zone…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="input-dark w-64 max-w-full"
          aria-label="Search assets"
        />
        <p className="text-xs text-slate-500 hidden sm:block">
          {table.getFilteredRowModel().rows.length} asset
          {table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-surface-border bg-navy-900">
              {table.getHeaderGroups().map((hg) =>
                hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`px-4 py-3 text-left label-muted whitespace-nowrap select-none
                                ${header.column.getCanSort() ? 'cursor-pointer hover:text-slate-300 transition-colors' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() &&
                        (header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp size={11} />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ChevronDown size={11} />
                        ) : (
                          <ChevronsUpDown size={11} className="text-slate-600" />
                        ))}
                    </div>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody className="bg-navy-800">
            {table.getRowModel().rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-surface-border/50 hover:bg-navy-750 transition-colors
                            ${idx % 2 === 0 ? '' : 'bg-navy-850'}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-500 bg-navy-800">
            No assets match your current filters.
          </div>
        )}
      </div>
    </div>
  );
}
