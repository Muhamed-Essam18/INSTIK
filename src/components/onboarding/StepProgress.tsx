/** "Step N of 4" and the four-part bar. The bar is decoration; the text carries the meaning. */
export function StepProgress({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-space-2">
      <p className="m-0 text-right text-label text-slate">Step {step} of 4</p>
      <div aria-hidden="true" className="grid grid-cols-4 gap-space-2">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`block h-1.5 rounded-pill ${n <= step ? "bg-coral" : "bg-hairline"}`} />
        ))}
      </div>
    </div>
  );
}
