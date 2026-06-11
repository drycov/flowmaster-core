import { describe, expect, it } from "vitest";
import {
  buildAuthorTemplateDefaults,
  buildOrganizationTemplateDefaults,
  buildProfilePresetDefaults,
  formatShortName,
  resolveSignatoryUserId,
} from "./author-field-values";

describe("formatShortName", () => {
  it("formats patronymic initials", () => {
    expect(formatShortName("Иванов Иван Иванович")).toBe("Иванов И.И.");
    expect(formatShortName("Рыков Д. И.")).toBe("Рыков Д.И.");
  });
});

describe("buildOrganizationTemplateDefaults", () => {
  it("fills organization_name", () => {
    expect(buildOrganizationTemplateDefaults({ name_ru: "АО «Тест»" })).toEqual({
      organization_name: "АО «Тест»",
    });
  });
});

describe("buildProfilePresetDefaults", () => {
  it("fills editor preset keys from profile", () => {
    const values = buildProfilePresetDefaults({
      full_name_ru: "Иванов Иван",
      departments: { name_ru: "Отдел кадров" },
      positions: { title_ru: "Специалист" },
      phone: "+7 701 000 00 00",
    });

    expect(values.full_name).toBe("Иванов Иван");
    expect(values.department).toBe("Отдел кадров");
    expect(values.responsible_person).toBe("Иванов Иван");
    expect(values.position).toBe("Специалист");
    expect(values.phone).toBe("+7 701 000 00 00");
  });
});

describe("buildAuthorTemplateDefaults", () => {
  it("maps author to executor and signatory to sender", () => {
    const author = {
      full_name_ru: "Петров Петр Петрович",
      position_ru: "Специалист",
      phone: "+7 701 000 00 00",
    };
    const signatory = {
      full_name_ru: "Рыков Дмитрий Иванович",
      position_ru: "Начальник ОЭСС",
    };

    const values = buildAuthorTemplateDefaults(author, signatory);

    expect(values.executor_name).toBe("Петров Петр Петрович");
    expect(values.executor_position).toBe("Специалист");
    expect(values.executor_phone).toBe("+7 701 000 00 00");
    expect(values.sender_name).toBe("Рыков Дмитрий Иванович");
    expect(values.sender_position).toBe("Начальник ОЭСС");
    expect(values.sender_short_name).toBe("Рыков Д.И.");
  });
});

describe("resolveSignatoryUserId", () => {
  it("prefers department head over author", () => {
    expect(
      resolveSignatoryUserId("author-id", { head_user_id: "head-id" }, null, null),
    ).toBe("head-id");
  });

  it("uses author when they are department head", () => {
    expect(
      resolveSignatoryUserId("author-id", { head_user_id: "author-id" }, null, null),
    ).toBe("author-id");
  });
});
