import { useEffect, useState, type InputHTMLAttributes } from "react";
import { Input } from "./input";

export function NumericInput({
  value,
  onValue,
  min = 0,
  ...props
}: {
  value: number;
  onValue: (n: number) => void;
  min?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={focused ? text : String(value)}
      onFocus={() => {
        setFocused(true);
        setText(String(value));
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        setText(raw);
        if (raw !== "") onValue(Number(raw));
      }}
      onBlur={() => {
        setFocused(false);
        if (text === "") {
          onValue(min);
          setText(String(min));
        } else {
          const n = Math.max(min, Number(text) || min);
          onValue(n);
          setText(String(n));
        }
      }}
    />
  );
}
