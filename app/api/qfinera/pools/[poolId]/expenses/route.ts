import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { EXPENSE_CATEGORIES, EXPENSE_STATUSES, createExpense, listExpenses } from "@/lib/fund/services/expenses";
import { parseDecimal, parseEnum, parseIsoDate, parseOptionalText, parsePaging, parseText, readJsonObject } from "@/lib/fund/validation";

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    const sp = req.nextUrl.searchParams;
    const { page, pageSize, offset } = parsePaging(sp);
    const { rows, total } = await listExpenses(readDb(), ctx.actor, ctx.fund.id, {
      status: sp.get("status") ? parseEnum(sp.get("status"), "status", EXPENSE_STATUSES) : null,
      pageSize,
      offset,
    });
    return jsonOk({ expenses: rows, page, pageSize, total });
  });
}

export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      const expense = await createExpense(sctx, {
        category: parseEnum(body.category, "category", EXPENSE_CATEGORIES),
        amount: parseDecimal(body.amount, { label: "amount", scale: 2, positive: true }),
        expenseDate: parseIsoDate(body.expenseDate, "expenseDate"),
        description: parseText(body.description, "description", { min: 3, max: 500 }),
        paymentReference: parseOptionalText(body.paymentReference, "paymentReference", 100),
      });
      return jsonOk({ expense }, 201);
    },
    { mutation: true }
  );
}
