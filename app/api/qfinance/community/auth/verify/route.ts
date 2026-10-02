import { NextResponse, type NextRequest } from "next/server";

// Old sign-in links from emails sent before password sign-in: never sign
// anyone in; send them to the sign-in page with an explanation.
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/qfinera/login?notice=link-retired", req.url));
}
