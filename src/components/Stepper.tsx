const STEPS = ["대시보드", "업로드", "AI 생성", "검토·수정", "완료"];

export default function Stepper({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <ol className="flex items-center gap-1 text-sm">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const state = step === current ? "current" : step < current ? "done" : "upcoming";
        return (
          <li key={label} className="flex items-center gap-1">
            {i > 0 && <span className="mx-1 h-px w-4 bg-neutral-300" aria-hidden />}
            <span
              className={[
                "flex items-center gap-1.5 rounded-full px-2.5 py-1",
                state === "current" && "bg-neutral-900 text-white font-medium",
                state === "done" && "bg-neutral-200 text-neutral-600",
                state === "upcoming" && "text-neutral-400",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className={[
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                  state === "current" && "bg-white text-neutral-900",
                  state === "done" && "bg-neutral-400 text-white",
                  state === "upcoming" && "border border-neutral-300",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {step}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
