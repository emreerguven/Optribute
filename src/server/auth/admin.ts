import { createHmac, randomInt, timingSafeEqual, randomUUID } from "node:crypto";
import { db } from "@/src/server/db";
import { normalizePhone } from "@/src/server/domain/phone";
import { getAuthSecret, getAdminSession, setAdminSessionCookie } from "@/src/server/auth/session";
import { deliverAdminLoginCode } from "@/src/server/auth/sms";

const LOGIN_CODE_TTL_MINUTES = 10;

function hashLoginCode(input: { companyId: string; normalizedPhone: string; code: string }) {
  return createHmac("sha256", getAuthSecret())
    .update(`${input.companyId}:${input.normalizedPhone}:${input.code}`)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function generateLoginCode() {
  return String(randomInt(100000, 1000000));
}

export async function requestAdminLoginCode(companyId: string, phone: string) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new Error("Telefon numarası geçersiz");
  }

  const adminUser = await db.adminUser.findFirst({
    where: {
      companyId,
      normalizedPhone,
      isActive: true
    }
  });

  if (!adminUser) {
    throw new Error("Bu telefon numarası yönetim girişi için yetkili değil");
  }

  const code = generateLoginCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOGIN_CODE_TTL_MINUTES * 60 * 1000);

  await db.adminLoginCode.updateMany({
    where: {
      companyId,
      normalizedPhone,
      consumedAt: null
    },
    data: {
      consumedAt: now
    }
  });

  await db.adminLoginCode.create({
    data: {
      id: `admin_code_${randomUUID()}`,
      companyId,
      phone: adminUser.phone,
      normalizedPhone,
      codeHash: hashLoginCode({ companyId, normalizedPhone, code }),
      expiresAt
    }
  });

  const delivery = await deliverAdminLoginCode({ phone: adminUser.phone, code });

  return {
    expiresAt,
    delivery
  };
}

export async function verifyAdminLoginCode(companyId: string, phone: string, code: string) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedCode = code.trim();

  if (!normalizedPhone || !/^\d{6}$/.test(normalizedCode)) {
    throw new Error("Doğrulama kodu geçersiz");
  }

  const adminUser = await db.adminUser.findFirst({
    where: {
      companyId,
      normalizedPhone,
      isActive: true
    }
  });

  if (!adminUser) {
    throw new Error("Bu telefon numarası yönetim girişi için yetkili değil");
  }

  const loginCode = await db.adminLoginCode.findFirst({
    where: {
      companyId,
      normalizedPhone,
      consumedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!loginCode) {
    throw new Error("Kod süresi doldu veya kod bulunamadı");
  }

  const expectedHash = hashLoginCode({ companyId, normalizedPhone, code: normalizedCode });

  if (!safeEqual(loginCode.codeHash, expectedHash)) {
    throw new Error("Doğrulama kodu hatalı");
  }

  await db.adminLoginCode.update({
    where: {
      id: loginCode.id
    },
    data: {
      consumedAt: new Date()
    }
  });

  await setAdminSessionCookie({
    adminUserId: adminUser.id,
    companyId,
    normalizedPhone
  });

  return adminUser;
}

export async function getAdminUserForCompany(companyId: string) {
  const session = await getAdminSession();

  if (!session || session.companyId !== companyId) {
    return null;
  }

  return db.adminUser.findFirst({
    where: {
      id: session.adminUserId,
      companyId,
      normalizedPhone: session.normalizedPhone,
      isActive: true
    }
  });
}
