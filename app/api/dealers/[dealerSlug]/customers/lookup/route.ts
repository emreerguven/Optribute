import { NextResponse } from "next/server";
import { findCustomerOperatorProfileByNormalizedPhone } from "@/src/server/domain/customers/service";
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

  const profile = await findCustomerOperatorProfileByNormalizedPhone(dealer.id, normalizedPhone);

  if (!profile) {
    return NextResponse.json({ found: false });
  }

  const customer = profile.customer;
  const defaultAddress =
    customer.addresses.find((address) => address.isDefault) ?? customer.addresses[0];

  return NextResponse.json({
    found: true,
    customer: {
      fullName: customer.fullName,
      phone: customer.phone,
      addressLine: defaultAddress?.line1Normalized ?? defaultAddress?.line1 ?? "",
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
      addressQualityStatus: defaultAddress?.addressQualityStatus ?? null,
      notes: customer.notes,
      lastOrderDate: profile.lastOrderDate,
      recentOrder: profile.recentOrder,
      frequentProducts: profile.frequentProducts
    }
  });
}
