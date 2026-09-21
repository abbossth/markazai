"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Option = { value: string; label: string };

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
};

/** Base UI Select ustidagi oddiy o'ram: options massivi bilan ishlaydi va tanlangan yorliqni ko'rsatadi. */
export function SimpleSelect({ value, onValueChange, options, placeholder, id, className, disabled, ...rest }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v ?? "")} disabled={disabled}>
      <SelectTrigger id={id} className={className ?? "w-full"} aria-invalid={rest["aria-invalid"]}>
        <SelectValue placeholder={placeholder}>
          {(v: string | null) => options.find((o) => o.value === v)?.label ?? placeholder ?? ""}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
