import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/themes/theme-provider";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex w-full items-center">
      <Button
        variant="outline"
        size="icon"
        className="mr-3 cursor-pointer"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        {resolvedTheme === "dark" ? (
          <Sun className="h-[1.2rem] w-[1.2rem]" />
        ) : (
          <Moon className="h-[1.2rem] w-[1.2rem]" />
        )}
      </Button>
      <span className="text-sm"></span>
    </div>
  );
}
