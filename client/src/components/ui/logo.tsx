import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export type LogoSize = "sm" | "md" | "lg" | "banner";
export type LogoVariant = "icon" | "full";

interface LogoProps {
  size?: LogoSize;
  variant?: LogoVariant;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  forceTheme?: "light" | "dark";
  alt?: string;
}

/**
 * Reusable Logo component for Mtaa DAO branding
 * 
 * @param size - Size of the logo: "sm", "md", "lg", or "banner"
 * @param variant - Logo variant: "icon" (logo mark only) or "full" (logo + text)
 * @param className - Additional CSS classes for the container
 * @param iconClassName - Additional CSS classes for the icon
 * @param textClassName - Additional CSS classes for the text logo
 * @param forceTheme - Force a specific theme regardless of current theme setting
 * @param alt - Alt text for accessibility (defaults to "Mtaa DAO")
 */
export function Logo({
  size = "md",
  variant = "icon",
  className,
  iconClassName,
  textClassName,
  forceTheme,
  alt = "Mtaa DAO"
}: LogoProps) {
  const { theme } = useTheme();
  const effectiveTheme = forceTheme || theme;

  // Determine the base path for logos
  const basePath = "/attached_assets/mtaa_dao_logos";

  // Size to dimension mapping
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
    banner: "w-20 h-20"
  };

  const textHeights = {
    sm: "h-4",
    md: "h-7",
    lg: "h-10",
    banner: "h-12"
  };

  // Construct the logo path
  const getLogoPath = (type: "icon" | "full") => {
    const themeStr = effectiveTheme === "dark" ? "dark" : "light";
    return `${basePath}/${type}_${themeStr}_${size}.png`;
  };

  if (variant === "full") {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <img
          src={getLogoPath("icon")}
          alt={`${alt} Icon`}
          className={cn(iconSizes[size], "object-contain", iconClassName)}
        />
        <img
          src={getLogoPath("full")}
          alt={alt}
          className={cn(textHeights[size], "object-contain", textClassName)}
        />
      </div>
    );
  }

  return (
    <img
      src={getLogoPath("icon")}
      alt={alt}
      className={cn(iconSizes[size], "object-contain", className)}
    />
  );
}

/**
 * Animated Logo component with hover effects
 */
export function AnimatedLogo({
  size = "md",
  variant = "icon",
  className,
  ...props
}: LogoProps) {
  return (
    <div className="group relative">
      <Logo
        size={size}
        variant={variant}
        className={cn("transition-transform duration-300 group-hover:scale-105", className)}
        {...props}
      />
    </div>
  );
}

/**
 * Logo with glow effect for hero sections
 */
export function HeroLogo({
  size = "lg",
  variant = "icon",
  className,
  ...props
}: LogoProps) {
  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-pink-600/30 rounded-3xl blur-xl opacity-60 group-hover:opacity-80 transition-all duration-300 animate-pulse"></div>
      <Logo
        size={size}
        variant={variant}
        className={cn("relative transform group-hover:scale-110 transition-all duration-300", className)}
        {...props}
      />
    </div>
  );
}

