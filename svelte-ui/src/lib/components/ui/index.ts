// Simple primitives
export { default as Button, buttonVariants } from "./button.svelte";
export { default as Badge, badgeVariants } from "./badge.svelte";
export { default as Input } from "./input.svelte";
export { default as Textarea } from "./textarea.svelte";
export { default as Label } from "./label.svelte";
export { default as Skeleton } from "./skeleton.svelte";
export { default as Separator } from "./separator.svelte";
export { default as Checkbox } from "./checkbox.svelte";
export { default as ScrollArea } from "./scroll-area.svelte";

// Card compound
export { default as Card } from "./card.svelte";
export { default as CardHeader } from "./card-header.svelte";
export { default as CardTitle } from "./card-title.svelte";
export { default as CardDescription } from "./card-description.svelte";
export { default as CardAction } from "./card-action.svelte";
export { default as CardContent } from "./card-content.svelte";
export { default as CardFooter } from "./card-footer.svelte";

// Avatar
export { default as Avatar } from "./avatar.svelte";
export { default as AvatarImage } from "./avatar-image.svelte";
export { default as AvatarFallback } from "./avatar-fallback.svelte";

// Alert
export { default as Alert } from "./alert.svelte";
export { default as AlertTitle } from "./alert-title.svelte";
export { default as AlertDescription } from "./alert-description.svelte";

// Progress
export { default as Progress } from "./progress.svelte";

// Tooltip
export { default as Tooltip } from "./tooltip.svelte";
export { default as TooltipContent } from "./tooltip-content.svelte";

// Collapsible
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./collapsible.svelte";

// Complex compound components — import from subdirectories
export * from "./dialog/index.js";
export * from "./popover/index.js";
export * from "./tabs/index.js";
export * from "./breadcrumb/index.js";
export * from "./dropdown-menu/index.js";
export * from "./select/index.js";
export * from "./sheet/index.js";
export * from "./command/index.js";
