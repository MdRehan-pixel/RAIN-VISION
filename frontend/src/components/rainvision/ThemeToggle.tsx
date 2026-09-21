import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem("rain-vision-theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("rain-vision-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      type="button"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setDark((value) => !value)}
      className="group relative flex h-10 w-[76px] items-center rounded-full border border-slate-200/70 bg-white/70 p-1 shadow-sm backdrop-blur-xl transition-all hover:shadow-md dark:border-white/10 dark:bg-slate-900/70"
    >
      <span
        className={`absolute top-1 grid h-8 w-8 place-items-center rounded-full shadow-sm transition-all duration-300 ${
          dark
            ? "translate-x-8 bg-slate-800 text-cyan-300"
            : "translate-x-0 bg-white text-amber-500"
        }`}
      >
        {dark ? <Moon size={16} /> : <Sun size={16} />}
      </span>

      <span className="flex w-full items-center justify-between px-2 text-slate-400">
        <Sun size={13} />
        <Moon size={13} />
      </span>
    </button>
  );
}
