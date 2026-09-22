import { cn } from "@/lib/utils";

/** Control Plane uchun yengil UI primitivlar (tenant-app'ning shadcn to'plamidan alohida — ilovalar mustaqil). */
const buttonBase = "inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
const buttonVariants = {
  default: "bg-primary text-primary-foreground border-transparent hover:opacity-90 h-9 px-4",
  outline: "bg-background hover:bg-muted h-9 px-4",
  ghost: "border-transparent hover:bg-muted h-9 px-3",
  destructive: "bg-destructive/10 text-destructive border-transparent hover:bg-destructive/20 h-9 px-4",
  sm: "bg-background hover:bg-muted h-8 px-3 text-xs",
} as const;

export function buttonClass(variant: keyof typeof buttonVariants = "default", className?: string) {
  return cn(buttonBase, buttonVariants[variant], className);
}

export function Button({ variant = "default", className, ...props }: React.ComponentProps<"button"> & { variant?: keyof typeof buttonVariants }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

const field = "border-input bg-background focus-visible:ring-ring/50 h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";
export const Input = (props: React.ComponentProps<"input">) => <input {...props} className={cn(field, props.className)} />;
export const Select = (props: React.ComponentProps<"select">) => <select {...props} className={cn(field, props.className)} />;
export const Textarea = (props: React.ComponentProps<"textarea">) => <textarea {...props} className={cn(field, "h-auto py-2", props.className)} />;

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </label>
  );
}

export function Card({ title, actions, children, className }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bg-card flex flex-col gap-4 rounded-xl border p-5", className)}>
      {(title || actions) && (
        <div className="flex items-center gap-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
      )}
      {children}
    </section>
  );
}

const tones = { neutral: "bg-muted text-foreground", good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300", bad: "bg-rose-500/15 text-rose-700 dark:text-rose-300" } as const;
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr:last-child]:border-0 [&>tr>td]:px-4 [&>tr>td]:py-2.5">{children}</tbody>
      </table>
      {empty && <p className="text-muted-foreground p-6 text-center text-sm">{empty}</p>}
    </div>
  );
}

export function PageHeader({ title, actions, sub }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {sub && <p className="text-muted-foreground text-sm">{sub}</p>}
      </div>
      <div className="ml-auto flex gap-2">{actions}</div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card flex flex-col gap-1 rounded-xl border p-5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </div>
  );
}

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("bg-muted animate-pulse rounded-md", className)} {...props} />;
}
