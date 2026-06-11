import { sap } from "@/components/auth/styles/sap-tokens";
import { useI18n } from "@/i18n";

const STEPS = [
  "auth.workflow.create",
  "auth.workflow.approve",
  "auth.workflow.sign",
  "auth.workflow.execute",
  "auth.workflow.archive",
] as const;

function splitLabel(text: string): [string, string?] {
  const words = text.split(" ");
  if (words.length <= 2) return [text];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export function AuthWorkflowIllustration() {
  const { t } = useI18n();

  return (
    <div className="relative w-full max-w-3xl" aria-hidden role="presentation">
      <svg
        viewBox="0 0 420 108"
        className="h-auto w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {STEPS.map((key, index) => {
          const x = 4 + index * 82;
          const isLast = index === STEPS.length - 1;
          const [line1, line2] = splitLabel(t(key));

          return (
            <g key={key}>
              <rect
                x={x}
                y="24"
                width="72"
                height="60"
                rx="4"
                fill="rgba(255,255,255,0.08)"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="1"
              />
              <rect x={x + 8} y="32" width="18" height="18" rx="2" fill={sap.brand} />
              <text
                x={x + 17}
                y="45"
                fill="#FFFFFF"
                fontSize="10"
                fontFamily="72, Inter, Segoe UI, system-ui, sans-serif"
                fontWeight="600"
                textAnchor="middle"
              >
                {index + 1}
              </text>
              <text
                fill="rgba(255,255,255,0.92)"
                fontSize="9"
                fontFamily="72, Inter, Segoe UI, system-ui, sans-serif"
                fontWeight="400"
              >
                <tspan x={x + 8} y={line2 ? 58 : 66}>
                  {line1}
                </tspan>
                {line2 ? (
                  <tspan x={x + 8} dy="11">
                    {line2}
                  </tspan>
                ) : null}
              </text>

              {!isLast && (
                <>
                  <line
                    x1={x + 72}
                    y1="54"
                    x2={x + 82}
                    y2="54"
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points={`${x + 82},54 ${x + 77},51 ${x + 77},57`}
                    fill="rgba(255,255,255,0.35)"
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
