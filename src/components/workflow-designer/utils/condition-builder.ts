export interface ParsedCondition {
  field: string;
  operator: string;
  value: string;
}

export const parseCondition = (conditionStr: string = ""): ParsedCondition => {
  const patterns = [
    { regex: /(\w+)\s*(===|!==|>=|<=|>|<)\s*['"](.+)['"]/, fields: ["field", "operator", "value"] },
    {
      regex: /(\w+)\s*(includes|startsWith|endsWith)\s*['"](.+)['"]/,
      fields: ["field", "operator", "value"],
    },
  ];

  for (const pattern of patterns) {
    const match = conditionStr.match(pattern.regex);
    if (match) {
      const result: ParsedCondition = {
        field: "",
        operator: "===",
        value: "",
      };
      pattern.fields.forEach((field, idx) => {
        if (field === "field") result.field = match[idx + 1];
        if (field === "operator") result.operator = match[idx + 1];
        if (field === "value") result.value = match[idx + 1];
      });
      return result;
    }
  }

  return { field: "", operator: "===", value: "" };
};

export const buildCondition = (field: string, operator: string, value: string): string => {
  if (!field || !value) return "";

  if (operator === "includes") return `${field}.includes('${value}')`;
  if (operator === "startsWith") return `${field}.startsWith('${value}')`;
  if (operator === "endsWith") return `${field}.endsWith('${value}')`;

  return `${field} ${operator} '${value}'`;
};
