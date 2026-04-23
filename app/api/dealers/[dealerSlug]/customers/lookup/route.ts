import { NextResponse } from "next/server";
import { findCustomerByNormalizedPhone } from "@/src/server/domain/customers/service";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { normalizePhone } from "@/src/server/domain/phone";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dealerSlug: string }> }
) {
  const { dealerSlug } = await params;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone") ?? "";
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return NextResponse.json({ error: "Phone is required" }, { status: 400 });
  }

  const customer = await findCustomerByNormalizedPhone(dealer.id, normalizedPhone);

  if (!customer) {
    return NextResponse.json({ found: false });
  }

  const defaultAddress =
    customer.addresses.find((address) => address.isDefault) ?? customer.addresses[0];

  return NextResponse.json({
    found: true,
    customer: {
      fullName: customer.fullName,
      phone: customer.phone,
      addressLine: defaultAddress?.line1 ?? "",
      deliveryAddress: defaultAddress
        ? {
            district: defaultAddress.district,
            neighborhood: defaultAddress.neighborhood,
            street: defaultAddress.street,
            buildingNo: defaultAddress.buildingNo,
            apartmentNo: defaultAddress.apartmentNo,
            siteName: defaultAddress.siteName,
            addressNote: defaultAddress.addressNote
          }
        : null,
      notes: customer.notes
    }
  });
}
