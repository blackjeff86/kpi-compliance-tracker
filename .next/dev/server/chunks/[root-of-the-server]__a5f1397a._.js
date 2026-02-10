module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "sql",
    ()=>sql
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$neondatabase$2b$serverless$40$1$2e$0$2e$2$2f$node_modules$2f40$neondatabase$2f$serverless$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/@neondatabase+serverless@1.0.2/node_modules/@neondatabase/serverless/index.mjs [app-route] (ecmascript)");
;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
const sql = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$neondatabase$2b$serverless$40$1$2e$0$2e$2$2f$node_modules$2f40$neondatabase$2f$serverless$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["neon"])(DATABASE_URL);
}),
"[project]/app/api/controls/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_react$2d$dom$40$18$2e$2$2e$0_react$40$18$2e$2$2e$0_$5f$react$40$18$2e$2$2e$0$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.1.6_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/db.ts [app-route] (ecmascript)");
;
;
const dynamic = "force-dynamic";
function normalizeFramework(code) {
    const v = (code || "").toUpperCase();
    if (v === "SOX" || v === "SOC" || v === "ISO" || v === "PCI") return v;
    return "SOX";
}
function normalizeRisk(riskLevel) {
    const v = (riskLevel || "").toUpperCase();
    if (v === "LOW") return "LOW";
    if (v === "MED" || v === "MEDIUM") return "MED";
    if (v === "HIGH") return "HIGH";
    if (v === "CRITICAL") return "CRITICAL";
    return "MED";
}
function normalizeFrequency(freq) {
    const v = (freq || "").toUpperCase();
    if (v === "MONTHLY") return "MONTHLY";
    if (v === "QUARTERLY") return "QUARTERLY";
    if (v === "SEMIANNUAL") return "SEMIANNUAL";
    if (v === "ANNUAL") return "ANNUAL";
    return "CONTINUOUS";
}
function addByFrequency(iso, freq) {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    const n = new Date(d);
    if (freq === "MONTHLY") n.setMonth(n.getMonth() + 1);
    else if (freq === "QUARTERLY") n.setMonth(n.getMonth() + 3);
    else if (freq === "SEMIANNUAL") n.setMonth(n.getMonth() + 6);
    else if (freq === "ANNUAL") n.setFullYear(n.getFullYear() + 1);
    else n.setMonth(n.getMonth() + 1);
    return n.toISOString().slice(0, 10);
}
async function GET() {
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sql"]`
    select
      c.id,
      f.code as framework_code,
      c.control_code,
      c.name,
      c.description,
      c.frequency::text as frequency,
      c.risk_level,
      c.owner_email,
      c.focal_email,

      count(distinct k.id)::int as total_kpis,

      coalesce(sum(case when r.status::text = 'GREEN' then 1 else 0 end),0)::int as green_kpis,
      coalesce(sum(case when r.status::text = 'YELLOW' then 1 else 0 end),0)::int as yellow_kpis,
      coalesce(sum(case when r.status::text = 'RED' then 1 else 0 end),0)::int as red_kpis,

      max(r.created_at)::text as last_exec_at

    from controls c
    join frameworks f on f.id = c.framework_id
    left join kpis k on k.control_id = c.id and k.is_active = true
    left join kpi_runs r on r.kpi_id = k.id and r.is_latest = true
    where c.is_active = true
    group by c.id, f.code, c.control_code, c.name, c.description, c.frequency, c.risk_level, c.owner_email, c.focal_email
    order by f.code, c.control_code;
  `;
    const data = rows.map((row)=>{
        const framework = normalizeFramework(row.framework_code);
        const risk = normalizeRisk(row.risk_level);
        const frequency = normalizeFrequency(row.frequency);
        const red = row.red_kpis ?? 0;
        const yellow = row.yellow_kpis ?? 0;
        const green = row.green_kpis ?? 0;
        const total = row.total_kpis ?? 0;
        const status = red > 0 ? "RED" : yellow > 0 ? "YELLOW" : "GREEN";
        const lastExecutionAt = row.last_exec_at ? row.last_exec_at.slice(0, 10) : undefined;
        const nextExecutionAt = addByFrequency(row.last_exec_at, frequency);
        return {
            id: row.control_code,
            code: row.control_code,
            name: row.name,
            framework,
            ownerName: row.owner_email,
            focalName: row.focal_email,
            frequency,
            risk,
            description: row.description ?? "",
            lastExecutionAt,
            nextExecutionAt,
            kpis: {
                total,
                green,
                yellow,
                red
            },
            status
        };
    });
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$1$2e$6_react$2d$dom$40$18$2e$2$2e$0_react$40$18$2e$2$2e$0_$5f$react$40$18$2e$2$2e$0$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(data);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a5f1397a._.js.map